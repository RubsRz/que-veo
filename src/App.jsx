import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SwipeCard from "./components/SwipeCard";
import Poster from "./components/Poster";
import DetailSheet from "./components/DetailSheet";
import Tonight from "./components/Tonight";
import { useLibrary } from "./lib/library";
import { cloudEnabled, loginWithGoogle, logout } from "./lib/firebase";
import { buildTaste, filterDeck, libraryStats, rankDeck } from "./lib/taste";
import { discover, getGenres, getProviders, hasApiKey } from "./lib/tmdb";

const TABS = [
    { id: "movies", icon: "🎬", label: "Pelis" },
    { id: "tv", icon: "📺", label: "Series" },
    { id: "lists", icon: "📚", label: "Mis listas" },
    { id: "profile", icon: "👤", label: "Perfil" },
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
                const results = await discover({ type: kind, page, taste });
                const fresh = rankDeck(filterDeck(results, library, seen.current), taste);
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

    async function handleDecide(item, decision, stars = null) {
        seen.current.add(item.id);
        await decide(item, decision, stars);
        setDecks((current) => ({ ...current, [item.type]: current[item.type].filter((card) => card.id !== item.id) }));
        setOpenItem(null);
        setToast(
            { liked: "👍 Guardada en “me gustaron”", watchlist: "🕑 A pendientes", disliked: "👎 Anotada", skipped: "🚫 No te la vuelvo a mostrar" }[decision],
        );
    }

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
    const deck = decks[type];
    const current = deck[0];

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
                            <div className="deck-actions">
                                <button type="button" className="action" title="No me interesa" onClick={() => handleDecide(current, "skipped")}>🚫</button>
                                <button type="button" className="action" title="La vi y no me gustó" onClick={() => handleDecide(current, "disliked")}>👎</button>
                                <button type="button" className="action" title="Pendiente por ver" onClick={() => handleDecide(current, "watchlist")}>🕑</button>
                                <button type="button" className="action action-main" title="La vi y me gustó" onClick={() => handleDecide(current, "liked")}>👍</button>
                            </div>
                            <p className="action-hint">Arrastra: → me gustó · ← paso · ↑ pendiente · ↓ no me gustó</p>
                        </>
                    )}
                </main>
            )}

            {tab === "lists" && (
                <main className="screen">
                    <button type="button" className="tonight-btn" onClick={() => setShowTonight(true)}>
                        🍿
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

                    {lists[listTab].length === 0 ? (
                        <div className="empty">
                            <b>Todavía no hay nada aquí</b>
                            <p>Califica algunas películas en la pestaña de Pelis y aparecerán en esta lista.</p>
                        </div>
                    ) : (
                        <div className="grid-cards" style={{ marginTop: 12 }}>
                            {lists[listTab].map((entry) => (
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
                        <span>{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </nav>

            {openItem && (
                <DetailSheet
                    item={openItem}
                    entry={library[openItem.id]}
                    onClose={() => setOpenItem(null)}
                    onDecide={handleDecide}
                    onForget={(id) => {
                        forget(id);
                        setOpenItem(null);
                        setToast("Quitada de tus listas");
                    }}
                />
            )}

            {showTonight && (
                <Tonight
                    watchlist={lists.watchlist}
                    providers={providers}
                    onClose={() => setShowTonight(false)}
                    onOpen={(item) => {
                        setShowTonight(false);
                        setOpenItem(item);
                    }}
                />
            )}

            {!authReady && cloudEnabled && <p className="toast">Conectando…</p>}
            {toast && <p className="toast">{toast}</p>}
        </div>
    );
}
