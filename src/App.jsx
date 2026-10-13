import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SwipeCard from "./components/SwipeCard";
import Poster from "./components/Poster";
import DetailSheet from "./components/DetailSheet";
import Tonight from "./components/Tonight";
import StarsPrompt from "./components/StarsPrompt";
import SearchSheet from "./components/SearchSheet";
import ActionButtons from "./components/ActionButtons";
import PosterViewer from "./components/PosterViewer";
import DetailPanel from "./components/DetailPanel";
import Avatar from "./components/Avatar";
import FriendsScreen from "./components/FriendsScreen";
import FriendSheet from "./components/FriendSheet";
import ListsScreen from "./components/ListsScreen";
import ListDetail from "./components/ListDetail";
import ShareSheet from "./components/ShareSheet";
import WhoLikedSheet from "./components/WhoLikedSheet";
import { useLibrary } from "./lib/library";
import { useFriends } from "./lib/friends";
import { friendsBadge } from "./lib/social";
import { toAvatarDataUrl } from "./lib/image";
import { cloudEnabled, loginWithGoogle, logout } from "./lib/firebase";
import { buildTaste, filterDeck, libraryStats, rankDeck } from "./lib/taste";
import { discover, getGenres, getProviders, hasApiKey, search } from "./lib/tmdb";

// Iconos de línea, al tono del resto de la interfaz
const ICONS = {
    explorar: "M9.5 7.5h8a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-8a2 2 0 012-2zM5.5 16.5V6a2 2 0 012-2h10",
    lists: "M5 5h10v14H5zM15 7h4v12h-4M8 9h4M8 13h4",
    friends: "M9 11.4a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM2.6 19.5a6.4 6.4 0 0112.8 0M16.2 5.3a3.1 3.1 0 010 6M18 19.5a6.2 6.2 0 00-1.5-4",
    profile: "M12 11.5a3.6 3.6 0 100-7.2 3.6 3.6 0 000 7.2zM4.8 20a7.2 7.2 0 0114.4 0",
};

const TABS = [
    { id: "explorar", label: "Explorar" },
    { id: "lists", label: "Listas" },
    { id: "friends", label: "Amigos" },
    { id: "profile", label: "Perfil" },
];

// Cada tantas tarjetas se cuela una que habías descartado, por si cambiaste de opinión
const RESURFACE_EVERY = 12;

const TIPS_KEY = "que-veo:tips:v1";

const LIST_NAMES = {
    liked: "Me gustaron",
    watchlist: "Pendientes",
    disliked: "No me gustaron",
    skipped: "Descartadas",
};

export default function App() {
    const { user, authReady, libraryReady, library, lists, photo, savePhoto, decide, forget, mergeLocalIntoCloud } =
        useLibrary();
    const [tab, setTab] = useState("explorar");
    const [deckType, setDeckType] = useState("movie"); // el interruptor de Películas / Series
    const [listView, setListView] = useState(null); // la lista abierta a pantalla completa
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
    const [pendingLike, setPendingLike] = useState(null); // título esperando calificación
    const [lastAction, setLastAction] = useState(null); // para deshacer
    const [showSearch, setShowSearch] = useState(false);
    const [posterItem, setPosterItem] = useState(null);
    const photoInput = useRef(null);
    const [isDesktop, setIsDesktop] = useState(() => matchMedia("(min-width: 1000px)").matches);
    const [openFriend, setOpenFriend] = useState(null);
    const [whoItem, setWhoItem] = useState(null); // a quiénes les gustó el título de la tarjeta
    // La primera vez conviene decir cómo se usa la baraja
    const [showTips, setShowTips] = useState(() => !localStorage.getItem(TIPS_KEY));
    const [shareItem, setShareItem] = useState(null); // título a compartir; `true` = solo crear lista

    useEffect(() => {
        const media = matchMedia("(min-width: 1000px)");
        const update = (event) => setIsDesktop(event.matches);
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);
    const [toast, setToast] = useState(null);
    const seen = useRef(new Set());
    // Páginas seguidas que no trajeron nada nuevo: evita pedir sin fin cuando ya viste todo
    const emptyTries = useRef({ movie: 0, tv: 0 });

    const social = useFriends(user, photo);
    // Para el puntito de la pestaña: invitaciones sin contestar y recomendaciones sin abrir
    const novedadesSociales = social.requests.length + social.recs.length;

    /** Lo que les gustó a tus amigos y tú no has visto, para "¿qué vemos hoy?". */
    const friendPicks = useMemo(() => {
        const picks = [];
        for (const [id, opinions] of Object.entries(social.ratings)) {
            if (library[id]) continue;
            const liked = opinions.filter((opinion) => opinion.decision === "liked");
            if (!liked.length) continue;
            const [best] = liked;
            picks.push({
                ...best.item,
                friendNote: `A ${best.name} le gustó${best.stars ? ` · ${best.stars}★` : ""}`,
            });
        }
        return picks;
    }, [social.ratings, library]);
    const friendOpinions = useCallback((item) => (item ? (social.ratings[item.id] ?? []) : []), [social.ratings]);

    const type = deckType;
    // Un perfil por tipo: los géneros de cine y los de televisión no son los mismos,
    // así que lo que calificaste se traduce al vocabulario del que estés viendo.
    const tastes = useMemo(() => {
        const entries = Object.values(library);
        return {
            movie: buildTaste(entries, { forType: "movie" }),
            tv: buildTaste(entries, { forType: "tv" }),
        };
    }, [library]);
    const taste = tastes[type];

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("theme", theme);
    }, [theme]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 1500);
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
                if (reset) emptyTries.current[kind] = 0;
                const found = await discover({ type: kind, page, taste });
                const fresh = rankDeck(filterDeck(found, library, seen.current), taste);
                emptyTries.current[kind] = fresh.length ? 0 : emptyTries.current[kind] + 1;

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
        // Hasta que no lleguen tus listas no se arma la baraja, para no repetir títulos
        if (libraryReady && decks[type].length === 0 && !error) loadMore(type, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, libraryReady]);

    // Red de seguridad: si algo ya decidido se coló en la baraja, se quita
    useEffect(() => {
        setDecks((current) => {
            const clean = {};
            let changed = false;
            for (const [kind, cards] of Object.entries(current)) {
                clean[kind] = cards.filter((card) => card.resurfaced || !library[card.id]);
                if (clean[kind].length !== cards.length) changed = true;
            }
            return changed ? clean : current;
        });
    }, [library]);

    // Cuando se está acabando la baraja (o ya se vació) se piden más páginas
    useEffect(() => {
        if (!loading && !error && decks[type].length < 4 && emptyTries.current[type] < 5) loadMore(type);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [decks, type]);

    function handleDecide(item, decision, stars = null) {
        // "Me gustó" sin calificación todavía: primero se piden las estrellas
        if (decision === "liked" && stars === null && !library[item.id]?.stars) {
            setToast(null); // que no estorbe mientras calificas
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
        setToast({
            text: {
                liked: stars ? `Guardada con ${stars}★` : "Guardada",
                watchlist: "En pendientes",
                disliked: "Anotada",
                skipped: "Descartada",
            }[decision],
            // El "deshacer" va aquí mismo, a la mano, en vez de escondido en la barra
            undo: { item, previous: library[item.id] ?? null },
        });
    }

    /** Deshacer la última decisión: la regresa a la baraja y restaura lo que estaba antes. */
    async function undo(action = lastAction) {
        if (!action) return;
        const { item, previous } = action;
        seen.current.delete(item.id);
        if (previous) await decide(previous, previous.decision, previous.stars);
        else await forget(item.id);
        setDecks((current) => ({ ...current, [item.type]: [item, ...current[item.type]] }));
        setLastAction(null);
        setToast("Deshecho");
    }

    /** Para "¿qué vemos hoy?": trae novedades del catálogo que no estén en tus listas. */
    const freshPool = useCallback(async () => {
        try {
            const found = await discover({
                type: "movie",
                page: 1 + Math.floor(Math.random() * 5),
                taste: tastes.movie,
            });
            return filterDeck(found, library, new Set());
        } catch {
            return [];
        }
    }, [tastes, library]);

    // En escritorio se puede decidir con el teclado
    useEffect(() => {
        if (!isDesktop) return;
        const onKey = (event) => {
            if (event.target.matches("input, textarea, select")) return;
            const card = decks[type][0];
            if (!card || openItem || pendingLike) return;
            const map = { ArrowRight: "liked", ArrowLeft: "skipped", ArrowUp: "watchlist", ArrowDown: "disliked" };
            if (map[event.key]) {
                event.preventDefault();
                handleDecide(card, map[event.key]);
            } else if (event.key === "z" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                undo();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    // Escape cierra lo que esté abierto encima, de arriba hacia abajo
    useEffect(() => {
        const onEscape = (event) => {
            if (event.key !== "Escape") return;
            const closers = [
                [posterItem, () => setPosterItem(null)],
                [showSearch, () => setShowSearch(false)],
                [listView, () => setListView(null)],
            ];
            const first = closers.find(([open]) => open);
            if (!first) return;
            event.preventDefault();
            first[1]();
        };
        window.addEventListener("keydown", onEscape);
        return () => window.removeEventListener("keydown", onEscape);
    }, [posterItem, showSearch, listView]);

    /** Cambiar la foto: se recorta y comprime aquí mismo antes de guardarla. */
    async function handlePhoto(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        try {
            await savePhoto(await toAvatarDataUrl(file));
            setToast("Foto actualizada");
        } catch (error) {
            setToast(error.message ?? "No se pudo usar esa imagen");
        }
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

    const visibleList = useMemo(
        () => (listView?.kind === "mine" ? lists[listView.id] : []),
        [lists, listView],
    );

    // La lista que estás viendo por dentro: una tuya o una en conjunto
    const openedList = useMemo(() => {
        if (!listView) return null;
        if (listView.kind === "mine") {
            const label = LIST_NAMES[listView.id];
            return { kind: "mine", id: listView.id, name: label, items: visibleList };
        }
        const shared = social.lists.find((list) => list.id === listView.id);
        return shared ? { ...shared, kind: "shared" } : null;
    }, [listView, visibleList, social.lists]);

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

            {tab === "explorar" && (
                <main className="screen is-deck">
                    <div className="deck-head">
                        <div className="segmented">
                            <button type="button" className={deckType === "movie" ? "is-active" : ""} onClick={() => setDeckType("movie")}>
                                Películas
                            </button>
                            <button type="button" className={deckType === "tv" ? "is-active" : ""} onClick={() => setDeckType("tv")}>
                                Series
                            </button>
                        </div>
                        <span className="action-hint" style={{ marginLeft: "auto", paddingBottom: 0 }}>
                            {taste.ready ? `A tu gusto · ${taste.rated} calificadas` : `Calibrando · ${taste.rated}/5`}
                        </span>

                    </div>

                    <div className="deck-layout">
                        <div className="deck-col">
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
                        {!error && !current && loading && (
                            <div className="card card-skeleton" aria-label="Cargando títulos">
                                <span className="shine" />
                            </div>
                        )}
                        {!error && !current && !loading && (
                            <div className="empty">
                                <b>Ya no hay más por ahora</b>
                                <p>Ya calificaste casi todo lo que había. Busca más o revisa tus listas.</p>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => {
                                        emptyTries.current[type] = 0;
                                        loadMore(type);
                                    }}
                                >
                                    Buscar más títulos
                                </button>
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
                                    friends={friendsBadge(social.ratings[item.id])}
                                    onDecide={(decision) => handleDecide(item, decision)}
                                    // En escritorio la ficha ya está fija a la derecha, así que
                                    // un clic en la tarjeta muestra el póster en grande
                                    onOpen={() => (isDesktop ? setPosterItem(item) : setOpenItem(item))}
                                    onPoster={() => setPosterItem(item)}
                                    onFriends={() => setWhoItem(item)}
                                />
                            ) : (
                                <article key={item.id} className="card" style={{ transform: "scale(0.96) translateY(10px)", opacity: 0.75 }}>
                                    {item.poster ? <img className="card-poster" src={item.poster} alt="" /> : <div className="card-fallback" />}
                                </article>
                            );
                        })}
                    </div>

                            {current && <ActionButtons onDecide={(decision) => handleDecide(current, decision)} />}
                        </div>

                        {isDesktop && (
                            <DetailPanel
                                item={current}
                                entry={current ? library[current.id] : null}
                                onDecide={handleDecide}
                                onForget={forget}
                                friendOpinions={friendOpinions(current)}
                                onShare={social.enabled ? setShareItem : null}
                            />
                        )}
                    </div>
                    {isDesktop && current && (
                        <p className="keys-hint">
                            Atajos: <kbd>←</kbd> paso · <kbd>→</kbd> me gustó · <kbd>↑</kbd> pendiente ·{" "}
                            <kbd>↓</kbd> no me gustó · <kbd>⌘Z</kbd> deshacer
                        </p>
                    )}
                </main>
            )}

            {tab === "lists" && !listView && (
                <>
                    <ListsScreen
                        lists={lists}
                        sharedLists={social.lists}
                        canShare={social.enabled}
                        onOpenMine={(id) => setListView({ kind: "mine", id })}
                        onOpenShared={(list) => setListView({ kind: "shared", id: list.id })}
                        onNewShared={() => setShareItem(true)}
                        onTonight={() => setShowTonight(true)}
                    />
                    <button type="button" className="fab" onClick={() => setShowSearch(true)} aria-label="Buscar un título">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <circle cx="11" cy="11" r="6.5" />
                            <path d="M16 16l4.5 4.5" />
                        </svg>
                    </button>
                </>
            )}

            {tab === "lists" && listView && openedList && (
                <ListDetail
                    list={openedList}
                    friends={social.friends}
                    social={social}
                    onBack={() => setListView(null)}
                    onOpenItem={setOpenItem}
                    onInvite={() => setShareItem(true)}
                    onToast={setToast}
                />
            )}

            {tab === "friends" && (
                <FriendsScreen
                    cloudEnabled={cloudEnabled}
                    user={user}
                    social={social}
                    library={library}
                    onLogin={handleLogin}
                    onOpenFriend={setOpenFriend}
                    onOpenItem={setOpenItem}
                    onToast={setToast}
                />
            )}

            {tab === "profile" && (
                <main className="screen">
                    <div className="profile-card">
                        <div className="profile-top">
                            <button
                                type="button"
                                className="avatar-button"
                                onClick={() => photoInput.current?.click()}
                                title="Cambiar foto"
                            >
                                <Avatar user={user} photo={photo} />
                                <span className="avatar-edit" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17z" />
                                    </svg>
                                </span>
                            </button>
                            <div>
                                <b>{user?.displayName ?? "Sin cuenta"}</b>
                                <p className="sheet-meta">
                                    {user ? "Tus listas se sincronizan" : cloudEnabled ? "Tus listas viven solo en este navegador" : "Modo local"}
                                </p>
                                <div className="photo-actions">
                                    <button type="button" onClick={() => photoInput.current?.click()}>
                                        Cambiar foto
                                    </button>
                                    {photo && (
                                        <button type="button" onClick={() => { savePhoto(null); setToast(user?.photoURL ? "Volvimos a la de Google" : "Foto quitada"); }}>
                                            {user?.photoURL ? "Usar la de Google" : "Quitar foto"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <input ref={photoInput} type="file" accept="image/*" hidden onChange={handlePhoto} />
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
                        onClick={() => {
                            setTab(item.id);
                            setListView(null); // al cambiar de pestaña se sale de la lista abierta
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d={ICONS[item.id]} />
                        </svg>
                        {item.id === "friends" && novedadesSociales > 0 && (
                            <span className="dot" aria-label={`${novedadesSociales} novedades`} />
                        )}
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
                    friendOpinions={friendOpinions(openItem)}
                    onShare={social.enabled ? setShareItem : null}
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
                    friendPicks={friendPicks}
                    onFresh={freshPool}
                    providers={providers}
                    onClose={() => setShowTonight(false)}
                    onOpen={(item) => {
                        setShowTonight(false);
                        setOpenItem(item);
                    }}
                />
            )}

            {openFriend && (
                <FriendSheet
                    friend={openFriend}
                    mine={library}
                    theirs={social.libraries[openFriend.uid] ?? {}}
                    onClose={() => setOpenFriend(null)}
                    onOpenItem={(item) => {
                        setOpenFriend(null);
                        setOpenItem(item);
                    }}
                    onRecommend={(item, friend) =>
                        social.recommend(item, friend).then(() => setToast(`Se la mandaste a ${friend.name}`))
                    }
                    onRemove={(friend) => {
                        social.remove(friend);
                        setOpenFriend(null);
                        setToast("Listo, ya no son amigos");
                    }}
                />
            )}

            {whoItem && (
                <WhoLikedSheet
                    item={whoItem}
                    opinions={friendOpinions(whoItem)}
                    onClose={() => setWhoItem(null)}
                />
            )}

            {shareItem && (
                <ShareSheet
                    item={shareItem === true ? null : shareItem}
                    friends={social.friends}
                    lists={social.lists}
                    social={social}
                    onClose={() => setShareItem(null)}
                    onToast={setToast}
                />
            )}

            {showTips && tab === "explorar" && current && (
                <div className="tips" onClick={() => { setShowTips(false); localStorage.setItem(TIPS_KEY, "1"); }}>
                    <div className="tips-card">
                        <h2>Así se usa</h2>
                        <ul>
                            <li><span className="tip-key">→</span> Me gustó</li>
                            <li><span className="tip-key">←</span> No me interesa</li>
                            <li><span className="tip-key">↑</span> Pendiente por ver</li>
                            <li><span className="tip-key">↓</span> La vi y no me gustó</li>
                            <li><span className="tip-key">·</span> Un toque abre la ficha</li>
                            <li><span className="tip-key">◉</span> Deja el dedo y ves el póster</li>
                        </ul>
                        <button type="button" className="btn btn-primary btn-wide">Va</button>
                    </div>
                </div>
            )}

            {pendingLike && (
                <StarsPrompt
                    item={pendingLike}
                    onSave={(stars) => commitDecision(pendingLike, "liked", stars)}
                    onCancel={() => setPendingLike(null)}
                />
            )}

            {!authReady && cloudEnabled && <p className="toast">Conectando…</p>}
            {toast && (
                <p className="toast" onClick={() => setToast(null)}>
                    {toast.text ?? toast}
                    {toast.undo && (
                        <button
                            type="button"
                            onClick={() => {
                                undo(toast.undo);
                                setToast(null);
                            }}
                        >
                            Deshacer
                        </button>
                    )}
                </p>
            )}
        </div>
    );
}
