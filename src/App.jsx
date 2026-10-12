import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SwipeCard from "./components/SwipeCard";
import Poster from "./components/Poster";
import DetailSheet from "./components/DetailSheet";
import Tonight from "./components/Tonight";
import StarsPrompt from "./components/StarsPrompt";
import SearchSheet from "./components/SearchSheet";
import ActionButtons from "./components/ActionButtons";
import PosterViewer from "./components/PosterViewer";
import { useLibrary } from "./lib/library";
import { cloudEnabled, loginWithGoogle, logout } from "./lib/firebase";
import { buildTaste, filterDeck, libraryStats, rankDeck } from "./lib/taste";
import { discover, getGenres, getProviders, hasApiKey, search } from "./lib/tmdb";

// Iconos de línea, al tono del resto de la interfaz
const ICONS = {
    movies: "M4 5.5h16v13H4zM4 10h16M9 5.5v4.5M15 5.5v4.5M9 14h6",
    tv: "M4 7.5h16v11H4zM9 3.5l3 4 3-4",
    lists: "M5 5h10v14H5zM15 7h4v12h-4M8 9h4M8 13h4",
    profile: "M12 11.5a3.6 3.6 0 100-7.2 3.6 3.6 0 000 7.2zM4.8 20a7.2 7.2 0 0114.4 0",
};

const TABS = [
    { id: "movies", label: "Pelis" },
    { id: "tv", label: "Series" },
    { id: "lists", label: "Mis listas" },
    { id: "profile", label: "Perfil" },
];

// Cada tantas tarjetas se cuela una que habías descartado, por si cambiaste de opinión
const RESURFACE_EVERY = 12;

const STAR_FILTERS = [
    { id: 0, label: "Todas" },
    { id: 5, label: "5★" },
    { id: 4, label: "4★ o más" },
    { id: 3, label: "3★ o más" },
    { id: -1, label: "Sin calificar" },
];

const LIST_TABS = [
    { id: "liked", label: "Me gustaron" },
    { id: "watchlist", label: "Pendientes" },
    { id: "disliked", label: "No me gustaron" },
    { id: "skipped", label: "Descartadas" },
];

export default function App() {
    const { user, authReady, library, lists, decide, forget, mergeLocalIntoCloud } = useLibrary();
    const [tab, setTab] = useState("movies");
    const [theme, setTheme] = useState(
        () => localStorage.getItem("theme") ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"),
    );
    const [genres, setGenres] = useState({});
    const [providers, setProviders] = useState([]);
    const [decks, setDecks] = useState({ movie: [], tv: [] });
    const [pages, setPages] = useState({ movie: 1, tv: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openItem, setOpenItem] = useState(null);
    const [showTonight, setShowTonight] = useState(false);
    const [listTab, setListTab] = useState("liked");
    const [starFilter, setStarFilter] = useState(0);
    const [pendingLike, setPendingLike] = useState(null); // título esperando calificación
    const [lastAction, setLastAction] = useState(null); // para deshacer
    const [showSearch, setShowSearch] = useState(false);
    const [posterItem, setPosterItem] = useState(null);
    const [pull, setPull] = useState(0); // 0..1, qué tanto jalaste la ficha hacia arriba
    const pullRef = useRef(0);
    const [toast, setToast] = useState(null);
    const seen = useRef(new Set());

    const type = tab === "tv" ? "tv" : "movie";
    const taste = useMemo(() => buildTaste(Object.values(library)), [library]);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("theme", theme);
    }, [theme]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2200);
        return () => clearTimeout(timer);
    }, [toast]);

    // Catálogos fijos: géneros (para las etiquetas) y plataformas (para los filtros)
    useEffect(() => {
        Promise.all([getGenres("movie"), getGenres("tv"), getProviders()])
            .then(([movieGenres, tvGenres, providerList]) => {
                setGenres(Object.fromEntries([...movieGenres, ...tvGenres].map((genre) => [genre.id, genre.name])));
                setProviders(providerList);
            })
            .catch(() => setGenres({}));
    }, []);

    /** Trae más títulos, quita los que ya decidiste y los ordena según tus gustos. */
    const loadMore = useCallback(
        async (kind, reset = false) => {
            setLoading(true);
            setError(null);
            try {
                const page = reset ? 1 : pages[kind];
                const found = await discover({ type: kind, page, taste });
                const fresh = rankDeck(filterDeck(found, library, seen.current), taste);

                // Se mete una descartada de vez en cuando, marcada para que se note
                const skipped = Object.values(library).filter(
                    (entry) => entry.decision === "skipped" && entry.type === kind && !seen.current.has(entry.id),
                );
                if (skipped.length && fresh.length > 3) {
                    const revive = skipped[Math.floor(Math.random() * skipped.length)];
                    fresh.splice(3, 0, { ...revive, resurfaced: true });
                }
                setDecks((current) => ({ ...current, [kind]: reset ? fresh : [...current[kind], ...fresh] }));
                setPages((current) => ({ ...current, [kind]: page + 1 }));
            } catch (requestError) {
                setError(requestError.message);
            } finally {
                setLoading(false);
            }
        },
        [pages, taste, library],
    );

    // Primera carga de cada baraja
    useEffect(() => {
        if (decks[type].length === 0 && !error) loadMore(type, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);

    // Cuando se está acabando la baraja, se piden más
    useEffect(() => {
        if (!loading && decks[type].length > 0 && decks[type].length < 4) loadMore(type);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [decks, type]);

    function handleDecide(item, decision, stars = null) {
        // "Me gustó" sin calificación todavía: primero se piden las estrellas
        if (decision === "liked" && stars === null && !library[item.id]?.stars) {
            setPendingLike(item);
            return;
        }
        return commitDecision(item, decision, stars);
    }

    async function commitDecision(item, decision, stars = null) {
        seen.current.add(item.id);
        setLastAction({ item, previous: library[item.id] ?? null });
        await decide(item, decision, stars);
        setDecks((current) => ({ ...current, [item.type]: current[item.type].filter((card) => card.id !== item.id) }));
        setOpenItem(null);
        setPendingLike(null);
        setToast(
            {
                liked: stars ? `👍 Guardada con ${stars}★` : "👍 Guardada en “me gustaron”",
                watchlist: "🕑 A pendientes",
                disliked: "👎 Anotada",
                skipped: "🚫 Casi no te la vuelvo a mostrar",
            }[decision],
        );
    }

    /** Deshacer la última decisión: la regresa a la baraja y restaura lo que estaba antes. */
    async function undo() {
        if (!lastAction) return;
        const { item, previous } = lastAction;
        seen.current.delete(item.id);
        if (previous) await decide(previous, previous.decision, previous.stars);
        else await forget(item.id);
        setDecks((current) => ({ ...current, [item.type]: [item, ...current[item.type]] }));
        setLastAction(null);
        setToast("↩︎ Deshecho");
    }

    /** La ficha sigue al dedo: al soltar, se abre si pasaste de la mitad. */
    function handlePull(item, progress) {
        if (progress === null) {
            if (pullRef.current > 0.5) setOpenItem(item);
            pullRef.current = 0;
            setPull(0);
            return;
        }
        pullRef.current = progress;
        setPull(progress);
    }

    /** Para "¿qué vemos hoy?": trae novedades del catálogo que no estén en tus listas. */
    const freshPool = useCallback(async () => {
        try {
            const found = await discover({ type: "movie", page: 1 + Math.floor(Math.random() * 5), taste });
            return filterDeck(found, library, new Set());
        } catch {
            return [];
        }
    }, [taste, library]);

    async function handleLogin() {
        try {
            await loginWithGoogle();
            const moved = await mergeLocalIntoCloud();
            setToast(moved ? `Sincronizadas ${moved} de tus pelis` : "Sesión iniciada");
        } catch {
            setToast("No se pudo iniciar sesión");
        }
    }

    const stats = useMemo(() => libraryStats(library, genres), [library, genres]);

    // Filtro por estrellas, solo en "me gustaron"
    const visibleList = useMemo(() => {
        const list = lists[listTab];
        if (listTab !== "liked" || starFilter === 0) return list;
        if (starFilter === -1) return list.filter((entry) => !entry.stars);
        return list.filter((entry) => (entry.stars ?? 0) >= starFilter);
    }, [lists, listTab, starFilter]);

    const deck = decks[type];
    const current = deck[0];
    // Mientras jalas la ficha todavía no hay selección: se usa la tarjeta de arriba
    const sheetItem = openItem ?? current;

    return (
        <div className="app">
            <header className="topbar">
                <p className="logo">
                    Qué<span>Veo</span>
                </p>
                <div className="topbar-actions">
                    <button type="button" className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Cambiar tema">
                        {theme === "dark" ? "☀" : "☾"}
                    </button>
                </div>
            </header>

            {(tab === "movies" || tab === "tv") && (
                <main className="screen is-deck">
                    <div className="deck-head">
                        <div className="segmented">
                            <button type="button" className={tab === "movies" ? "is-active" : ""} onClick={() => setTab("movies")}>
                                Películas
                            </button>
                            <button type="button" className={tab === "tv" ? "is-active" : ""} onClick={() => setTab("tv")}>
                                Series
                            </button>
                        </div>
                        <span className="action-hint" style={{ marginLeft: "auto", paddingBottom: 0 }}>
                            {taste.ready ? `A tu gusto · ${taste.rated} calificadas` : `Calibrando · ${taste.rated}/5`}
                        </span>
                        {lastAction && (
                            <button type="button" className="icon-btn" onClick={undo} title="Deshacer la última">
                                ↩︎
                            </button>
                        )}
                    </div>

                    <div className="deck">
                        {error && (
                            <div className="empty">
                                <b>No se pudo cargar el catálogo</b>
                                <p>{error}</p>
                                <button type="button" className="btn btn-primary" onClick={() => loadMore(type, true)}>
                                    Reintentar
                                </button>
                            </div>
                        )}
                        {!error && !current && loading && <p className="loading">Cargando títulos…</p>}
                        {!error && !current && !loading && (
                            <div className="empty">
                                <b>Ya no hay más por ahora</b>
                                <p>Cargamos más títulos en un momento, o revisa tus listas.</p>
                            </div>
                        )}

                        {/* Solo se montan dos tarjetas: la de arriba y la que asoma debajo */}
                        {deck.slice(0, 2).reverse().map((item, index, array) => {
                            const isTop = index === array.length - 1;
                            return isTop ? (
                                <SwipeCard
                                    key={item.id}
                                    item={item}
                                    genreNames={genres}
                                    onDecide={(decision) => handleDecide(item, decision)}
                                    onOpen={() => setOpenItem(item)}
                                    onPull={(progress) => handlePull(item, progress)}
                                    onPoster={() => setPosterItem(item)}
                                />
                            ) : (
                                <article key={item.id} className="card" style={{ transform: "scale(0.96) translateY(10px)", opacity: 0.75 }}>
                                    {item.poster ? <img className="card-poster" src={item.poster} alt="" /> : <div className="card-fallback" />}
                                </article>
                            );
                        })}
                    </div>

                    {current && (
                        <>
                            <ActionButtons onDecide={(decision) => handleDecide(current, decision)} />
                        </>
                    )}
                </main>
            )}

            {tab === "lists" && (
                <main className="screen">
                    <button type="button" className="tonight-btn" onClick={() => setShowTonight(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24, flexShrink: 0 }}>
                            <path d="M7 9l1.4 10.5h7.2L17 9zM7 9c0-2 1.4-3 2.5-3S11 7 12 7s1.4-1 2.5-1S17 7 17 9" />
                        </svg>
                        <span>
                            ¿Qué vemos hoy?
                            <small>Te elijo una de tus {lists.watchlist.length} pendientes</small>
                        </span>
                    </button>

                    <div className="list-tabs">
                        {LIST_TABS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={listTab === item.id ? "is-active" : ""}
                                onClick={() => setListTab(item.id)}
                            >
                                {item.label} · {lists[item.id].length}
                            </button>
                        ))}
                    </div>

                    {listTab === "liked" && lists.liked.length > 0 && (
                        <div className="list-tabs" style={{ marginTop: 8 }}>
                            {STAR_FILTERS.map((filter) => (
                                <button
                                    key={filter.id}
                                    type="button"
                                    className={starFilter === filter.id ? "is-active" : ""}
                                    onClick={() => setStarFilter(filter.id)}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <button type="button" className="fab" onClick={() => setShowSearch(true)} aria-label="Buscar un título">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <circle cx="11" cy="11" r="6.5" />
                            <path d="M16 16l4.5 4.5" />
                        </svg>
                    </button>

                    {visibleList.length === 0 ? (
                        <div className="empty">
                            <b>{lists[listTab].length ? "Nada con ese filtro" : "Todavía no hay nada aquí"}</b>
                            <p>
                                {lists[listTab].length
                                    ? "Prueba con otra calificación."
                                    : "Califica algunas películas en la pestaña de Pelis y aparecerán en esta lista."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid-cards" style={{ marginTop: 12 }}>
                            {visibleList.map((entry) => (
                                <Poster key={entry.id} item={entry} onClick={() => setOpenItem(entry)} />
                            ))}
                        </div>
                    )}
                </main>
            )}

            {tab === "profile" && (
                <main className="screen">
                    <div className="profile-card">
                        <div className="profile-top">
                            {user?.photoURL ? <img className="avatar" src={user.photoURL} alt="" /> : <span className="avatar" />}
                            <div>
                                <b>{user?.displayName ?? "Sin cuenta"}</b>
                                <p className="sheet-meta">
                                    {user ? "Tus listas se sincronizan" : cloudEnabled ? "Tus listas viven solo en este navegador" : "Modo local"}
                                </p>
                            </div>
                        </div>
                        {cloudEnabled ? (
                            user ? (
                                <button type="button" className="btn btn-ghost" onClick={logout}>Cerrar sesión</button>
                            ) : (
                                <button type="button" className="btn btn-primary" onClick={handleLogin}>Entrar con Google</button>
                            )
                        ) : (
                            <p className="notice">
                                Falta configurar Firebase: agrega las variables <b>VITE_FIREBASE_*</b> en tu archivo <b>.env</b> para
                                sincronizar tus listas entre dispositivos.
                            </p>
                        )}
                    </div>

                    <h2 className="section-title">Tus números</h2>
                    <dl className="stats-grid">
                        <div><dt>Vistas</dt><dd>{stats.liked + stats.disliked}</dd></div>
                        <div><dt>Pendientes</dt><dd>{stats.watchlist}</dd></div>
                        <div><dt>Horas</dt><dd>{stats.hours}</dd></div>
                        <div><dt>Promedio</dt><dd>{stats.averageStars ? `★ ${stats.averageStars}` : "—"}</dd></div>
                    </dl>

                    <h2 className="section-title">Tus géneros</h2>
                    {stats.topGenres.length === 0 ? (
                        <p className="notice">Califica unas cuantas y aquí vas a ver qué te late de verdad.</p>
                    ) : (
                        <div className="bars">
                            {stats.topGenres.map((genre) => (
                                <div key={genre.id} className="bar-row">
                                    <span>{genre.name}</span>
                                    <span className="bar"><i style={{ width: `${Math.round(genre.score * 100)}%` }} /></span>
                                </div>
                            ))}
                        </div>
                    )}

                    {!hasApiKey && (
                        <p className="notice" style={{ marginTop: 16 }}>
                            <b>Modo demo:</b> estás viendo unos cuantos títulos de ejemplo. Agrega tu llave{" "}
                            <b>VITE_TMDB_KEY</b> en <b>.env</b> para usar el catálogo completo de TMDB.
                        </p>
                    )}
                    <p className="notice">
                        Datos de películas y series por <b>TMDB</b>. Dónde verlas, por <b>JustWatch</b>.
                    </p>
                </main>
            )}

            <nav className="tabbar">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={tab === item.id ? "is-active" : ""}
                        onClick={() => setTab(item.id)}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d={ICONS[item.id]} />
                        </svg>
                        {item.label}
                    </button>
                ))}
            </nav>

            {(openItem || pull > 0) && sheetItem && (
                <DetailSheet
                    offset={openItem ? 0 : 1 - pull}
                    dragging={!openItem}
                    item={sheetItem}
                    entry={library[sheetItem.id]}
                    onClose={() => setOpenItem(null)}
                    onDecide={handleDecide}
                    onForget={(id) => {
                        forget(id);
                        setOpenItem(null);
                        setToast("Quitada de tus listas");
                    }}
                />
            )}

            {posterItem && <PosterViewer item={posterItem} onClose={() => setPosterItem(null)} />}

            {showSearch && (
                <SearchSheet
                    library={library}
                    onOpen={(item) => {
                        setShowSearch(false);
                        setOpenItem(item);
                    }}
                    onClose={() => setShowSearch(false)}
                />
            )}

            {showTonight && (
                <Tonight
                    lists={lists}
                    onFresh={freshPool}
                    providers={providers}
                    onClose={() => setShowTonight(false)}
                    onOpen={(item) => {
                        setShowTonight(false);
                        setOpenItem(item);
                    }}
                />
            )}

            {pendingLike && (
                <StarsPrompt
                    item={pendingLike}
                    onSave={(stars) => commitDecision(pendingLike, "liked", stars)}
                    onCancel={() => setPendingLike(null)}
                />
            )}

            {!authReady && cloudEnabled && <p className="toast">Conectando…</p>}
            {toast && <p className="toast">{toast}</p>}
        </div>
    );
}
