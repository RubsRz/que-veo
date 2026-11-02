import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DetailSheet from "./components/DetailSheet";
import Tonight from "./components/Tonight";
import StarsPrompt from "./components/StarsPrompt";
import SearchSheet from "./components/SearchSheet";
import PosterViewer from "./components/PosterViewer";
import FriendsScreen from "./components/FriendsScreen";
import FriendSheet from "./components/FriendSheet";
import ListsScreen from "./components/ListsScreen";
import ListDetail from "./components/ListDetail";
import ShareSheet from "./components/ShareSheet";
import WhoLikedSheet from "./components/WhoLikedSheet";
import ProfileEditor from "./components/ProfileEditor";
import AddFriendSheet from "./components/AddFriendSheet";
import ExploreScreen from "./components/ExploreScreen";
import ProfileScreen from "./components/ProfileScreen";
import ActionMenu from "./components/ActionMenu";
import ConfirmSheet from "./components/ConfirmSheet";
import InviteToListSheet from "./components/InviteToListSheet";
import ListSettingsSheet from "./components/ListSettingsSheet";
import JoinListSheet from "./components/JoinListSheet";
import ListPickSheet from "./components/ListPickSheet";
import PlatformsSheet from "./components/PlatformsSheet";
import { useLibrary } from "./lib/library";
import { useFriends } from "./lib/friends";
import { useDeck } from "./lib/useDeck";
import { listFromParam, useNavigation } from "./lib/useNavigation";
import { useListActions } from "./lib/useListActions";
import { splitRated } from "./lib/ratings";
import { toAvatarDataUrl } from "./lib/image";
import { platformCatalog } from "./lib/platforms";
import { cloudEnabled, loginWithGoogle, logout } from "./lib/firebase";
import { buildTaste, filterDeck, libraryStats } from "./lib/taste";
import { discover, getGenres, getProviders } from "./lib/tmdb";

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

const TIPS_KEY = "que-veo:tips:v1";

const byRecent = (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");

const LIST_NAMES = {
    liked: "Me gustaron",
    disliked: "No me gustaron",
    watchlist: "Quiero verlas",
    skipped: "No las he visto",
};

const TOAST_TEXT = {
    liked: (stars) => (stars ? `Guardada con ${stars}★` : "Guardada"),
    watchlist: () => "Quieres verla",
    disliked: () => "Anotada",
    skipped: () => "No la has visto",
};

export default function App() {
    const { user, authReady, libraryReady, library, lists, photo, name, localCount, platforms, savePhoto, saveName, savePlatforms, decide, restore, forget } =
        useLibrary();
    const nav = useNavigation();
    const { listView, overlays, closeList } = nav;
    // Si entraste con el link de una lista o una invitación, arrancas en Listas
    const [tab, setTab] = useState(() => (nav.initial.lista || nav.initial.invitacion ? "lists" : "explorar"));
    const [deckType, setDeckType] = useState("movie"); // el interruptor de Películas / Series
    const [theme, setTheme] = useState(
        () => localStorage.getItem("theme") ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"),
    );
    const [genres, setGenres] = useState({});
    const [providers, setProviders] = useState([]);
    const [lastAction, setLastAction] = useState(null); // para deshacer con ⌘Z
    const [isDesktop, setIsDesktop] = useState(() => matchMedia("(min-width: 1000px)").matches);
    // La primera vez conviene decir cómo se usa la baraja
    const [showTips, setShowTips] = useState(() => !localStorage.getItem(TIPS_KEY));
    const [toast, setToast] = useState(null);
    // La lista a la que acabas de entrar con un link: tarda un momento en llegar
    const [joiningId, setJoiningId] = useState(null);
    const photoInput = useRef(null);

    const social = useFriends(user, photo, name);
    const displayName = name ?? user?.displayName ?? null;
    // Para el puntito de la pestaña: invitaciones sin contestar y recomendaciones sin abrir
    const novedadesSociales = social.requests.length + social.recs.length;

    /**
     * Un aviso arriba. Si trae "Deshacer" dura más: en 1.5 s casi nadie alcanzaba
     * a leerlo y atinarle al botón.
     */
    const notify = useCallback((text, undo = null) => setToast({ text, undo, id: Date.now() }), []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), toast.undo ? 5000 : 1800);
        return () => clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
        const media = matchMedia("(min-width: 1000px)");
        const update = (event) => setIsDesktop(event.matches);
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("theme", theme);
    }, [theme]);

    // Catálogos fijos: géneros (para las etiquetas) y plataformas (para los filtros)
    useEffect(() => {
        Promise.all([getGenres("movie"), getGenres("tv"), getProviders()])
            .then(([movieGenres, tvGenres, providerList]) => {
                setGenres(Object.fromEntries([...movieGenres, ...tvGenres].map((genre) => [genre.id, genre.name])));
                setProviders(providerList);
            })
            .catch(() => setGenres({}));
    }, []);

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

    // Un perfil por tipo: los géneros de cine y los de televisión no son los mismos,
    // así que lo que calificaste se traduce al vocabulario del que estés viendo.
    const tastes = useMemo(() => {
        const entries = Object.values(library);
        return {
            movie: buildTaste(entries, { forType: "movie" }),
            tv: buildTaste(entries, { forType: "tv" }),
        };
    }, [library]);
    const taste = tastes[deckType];

    const deck = useDeck({ type: deckType, taste, library, libraryReady });

    /** Para saber quién ya vio qué en las listas en conjunto. */
    const seenContext = useMemo(
        () => ({ myUid: user?.uid ?? null, mine: library, libraries: social.libraries }),
        [user, library, social.libraries],
    );

    /** Nombre y foto de alguien: el perfil en vivo manda sobre la copia que guardó la lista. */
    const people = useCallback(
        (uid, list = null) => {
            if (uid === user?.uid) return { name: displayName ?? "Tú", photo: photo ?? user?.photoURL ?? null };
            return social.profiles[uid] ?? list?.profiles?.[uid] ?? {};
        },
        [user, displayName, photo, social.profiles],
    );

    /* ===================== Decidir y deshacer ===================== */

    function handleDecide(item, decision, stars = null) {
        // "Ya la vi" siempre pasa por el calificador, y de ahí se confirma
        if (decision === "liked" && stars === null) {
            setToast(null); // que no estorbe mientras calificas
            nav.open("stars", { item, purpose: "decide" });
            return;
        }
        commitDecision(item, decision, stars);
    }

    function commitDecision(item, decision, stars = null) {
        const action = { item, previous: library[item.id] ?? null };
        deck.take(item);
        setLastAction(action);
        // Se guarda en segundo plano: sin red, Firestore lo encola y la pantalla no se atora
        decide(item, decision, stars).catch(() => notify("No se pudo guardar"));
        nav.close(["detail", "stars"]);
        notify(TOAST_TEXT[decision](stars), () => undo(action));
    }

    /** Deshacer una decisión: regresa a la baraja y queda lo que estaba antes, tal cual. */
    function undo(action = lastAction) {
        if (!action) return;
        const { item, previous } = action;
        deck.putBack(item);
        (previous ? restore(previous) : forget(item.id)).catch(() => notify("No se pudo deshacer"));
        setLastAction(null);
        notify("Deshecho");
    }

    /** Quitar de tus listas, con vuelta atrás. */
    function forgetWithUndo(entry) {
        forget(entry.id).catch(() => notify("No se pudo quitar"));
        notify("Quitada de tus listas", () => restore(entry));
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
            if (event.key === "/" && !overlays.length) {
                event.preventDefault();
                nav.open("search");
                return;
            }
            const card = deck.deck[0];
            if (tab !== "explorar" || !card || overlays.length) return;
            const map = { ArrowRight: "liked", ArrowLeft: "skipped", ArrowUp: "watchlist" };
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

    // Escape: las hojas se cierran solas (la de hasta arriba); si no hay ninguna, sale de la lista
    useEffect(() => {
        const onEscape = (event) => {
            if (event.key !== "Escape" || overlays.length || !listView) return;
            event.preventDefault();
            closeList();
        };
        window.addEventListener("keydown", onEscape);
        return () => window.removeEventListener("keydown", onEscape);
    }, [overlays.length, listView, closeList]);

    /* ===================== Sesión y perfil ===================== */

    async function login() {
        try {
            await loginWithGoogle();
            notify("Sesión iniciada");
        } catch {
            notify("No se pudo iniciar sesión");
        }
    }

    /**
     * Entrar con Google. Lo que calificaste sin cuenta no se sube: si tu cuenta ya
     * tenía calificaciones, mezclarlas pisaría unas con otras. Se avisa antes.
     */
    function requestLogin() {
        if (user || localCount === 0) return login();
        nav.open("confirm", {
            title: "Antes de entrar",
            body: `En este navegador tienes ${localCount} ${localCount === 1 ? "título calificado" : "títulos calificados"} sin cuenta. Al entrar vas a ver lo que ya tiene tu cuenta: lo de aquí no se sube ni se mezcla, para no pisar tus calificaciones. Si cierras sesión, lo vuelves a ver aquí.`,
            confirmLabel: "Entrar de todos modos",
            danger: false,
            onConfirm: () => {
                // El popup de Google tiene que salir dentro del mismo toque
                login();
                nav.close("confirm");
            },
        });
    }

    /** Cambiar la foto: se recorta y comprime aquí mismo antes de guardarla. */
    async function handlePhoto(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        try {
            const dataUrl = await toAvatarDataUrl(file);
            await savePhoto(dataUrl);
            await social.publishProfile?.({ photo: dataUrl }); // que tus amigos la vean
            notify("Foto actualizada");
        } catch (error) {
            notify(error.message ?? "No se pudo usar esa imagen");
        }
    }

    const stats = useMemo(() => libraryStats(library, genres), [library, genres]);
    const catalog = useMemo(() => platformCatalog(providers), [providers]);

    function togglePlatform(key) {
        const next = platforms.includes(key) ? platforms.filter((item) => item !== key) : [...platforms, key];
        savePlatforms(next).catch(() => notify("No se pudo guardar"));
    }

    /** Elegir tus plataformas, desde Perfil o desde la ficha. */
    const goToPlatforms = () => nav.open("platforms");

    /* ===================== Listas ===================== */

    const visibleList = useMemo(() => {
        if (listView?.kind !== "mine") return [];
        // Lo calificado se parte por la nota: 3★ o más de un lado, el resto del otro
        if (listView.id === "liked" || listView.id === "disliked") {
            return splitRated(lists)[listView.id].sort(byRecent);
        }
        return lists[listView.id];
    }, [lists, listView]);

    const { sharedById, menuActions, listActions, watchedFromList, confirmLeave } = useListActions({
        user,
        library,
        social,
        nav,
        notify,
        decide,
        restore,
        forget,
        people,
        commitDecision,
        forgetWithUndo,
    });

    // La lista que estás viendo por dentro: una tuya o una en conjunto
    const openedList = useMemo(() => {
        if (!listView) return null;
        if (listView.kind === "mine") {
            return { kind: "mine", id: listView.id, name: LIST_NAMES[listView.id], items: visibleList };
        }
        const shared = sharedById(listView.id);
        return shared ? { ...shared, kind: "shared", items: social.listItems[shared.id] ?? [] } : null;
    }, [listView, visibleList, sharedById, social.listItems]);

    function changeTab(next) {
        nav.reset(); // al cambiar de pestaña se cierra lo que haya encima
        setTab(next);
    }

    /* ===================== Links de entrada ===================== */

    // ?lista=…, ?t=movie:123, ?u=usuario y ?l=token: se abren una sola vez al cargar
    const handledLinks = useRef(false);
    useEffect(() => {
        if (handledLinks.current) return;
        handledLinks.current = true;
        const { lista, titulo, usuario, invitacion } = nav.initial;
        if (lista) nav.openList(listFromParam(lista));
        if (titulo && /^(movie|tv):\d+$/.test(titulo)) {
            const [type, tmdbId] = titulo.split(":");
            nav.open("detail", { item: { id: titulo, type, tmdbId: Number(tmdbId), title: "" } });
        }
        if (usuario) nav.open("addFriend", { username: usuario });
        if (invitacion) nav.open("joinList", { token: invitacion });
    }, [nav]);

    /* ===================== Hojas ===================== */

    function renderOverlay(overlay) {
        const { id, kind, props } = overlay;
        const close = () => nav.close(id);

        switch (kind) {
            case "detail": {
                const entry = library[props.item.id];
                // Un título abierto desde un link llega casi vacío: si ya está en tus listas, se usa eso
                const item = props.item.title ? props.item : (entry ?? props.item);
                return (
                    <DetailSheet
                        key={id}
                        item={item}
                        entry={entry}
                        onClose={close}
                        onDecide={handleDecide}
                        onForget={() => {
                            nav.close(id);
                            forgetWithUndo(entry);
                        }}
                        friendOpinions={friendOpinions(item)}
                        onShare={social.enabled ? (full) => nav.open("share", { item: full }) : null}
                        myPlatforms={platforms}
                        onPickPlatforms={goToPlatforms}
                    />
                );
            }
            case "stars":
                return (
                    <StarsPrompt
                        key={id}
                        item={props.item}
                        entry={library[props.item.id]}
                        onSave={(stars) =>
                            props.purpose === "list"
                                ? watchedFromList(props.listId, props.item, stars)
                                : commitDecision(props.item, "liked", stars)
                        }
                        onSkip={props.purpose === "list" ? () => watchedFromList(props.listId, props.item, null) : null}
                        onCancel={close}
                    />
                );
            case "poster":
                return <PosterViewer key={id} item={props.item} onClose={close} />;
            case "search":
                return (
                    <SearchSheet
                        key={id}
                        library={library}
                        initialQuery={props.query ?? ""}
                        onOpen={(item) => nav.swap(id, "detail", { item })}
                        onClose={close}
                    />
                );
            case "tonight":
                return (
                    <Tonight
                        key={id}
                        lists={lists}
                        friendPicks={friendPicks}
                        onFresh={freshPool}
                        providers={providers}
                        onClose={close}
                        onOpen={(item) => nav.swap(id, "detail", { item })}
                    />
                );
            case "friend":
                return (
                    <FriendSheet
                        key={id}
                        friend={props.friend}
                        mine={library}
                        theirs={social.libraries[props.friend.uid] ?? {}}
                        onClose={close}
                        onOpenItem={(item) => nav.swap(id, "detail", { item })}
                        onRecommend={(item, friend) => social.recommend(item, friend).then(() => notify(`Se la mandaste a ${friend.name}`))}
                        onRemove={(friend) =>
                            nav.swap(id, "confirm", {
                                title: `¿Dejar de ser amigos con ${friend.name}?`,
                                body: "Ya no van a ver lo que califica cada quien ni podrán mandarse recomendaciones. Las listas que tienen juntos siguen igual.",
                                confirmLabel: "Dejar de ser amigos",
                                onConfirm: () => {
                                    nav.close("confirm");
                                    social
                                        .remove(friend)
                                        .then(() => notify("Listo, ya no son amigos"))
                                        .catch(() => notify("No se pudo"));
                                },
                            })
                        }
                    />
                );
            case "who":
                return <WhoLikedSheet key={id} item={props.item} opinions={friendOpinions(props.item)} onClose={close} />;
            case "share":
                return (
                    <ShareSheet
                        key={id}
                        item={props.item ?? null}
                        friends={social.friends}
                        lists={social.lists}
                        listItems={social.listItems}
                        social={social}
                        onToast={notify}
                        // Al crear una lista desde aquí, se abre de una vez
                        onClose={(createdId) => {
                            if (typeof createdId !== "string") return close();
                            setTab("lists");
                            nav.openList({ kind: "shared", id: createdId });
                        }}
                    />
                );
            case "profile":
                return (
                    <ProfileEditor
                        key={id}
                        user={user}
                        photo={photo}
                        name={displayName}
                        username={social.profile?.username}
                        onSaveUsername={
                            social.enabled
                                ? async (nuevo) => {
                                      try {
                                          await social.changeUsername(nuevo);
                                          notify("Usuario actualizado");
                                          return null;
                                      } catch (error) {
                                          notify(error.message);
                                          return error.message;
                                      }
                                  }
                                : null
                        }
                        onPickPhoto={() => photoInput.current?.click()}
                        onRemovePhoto={() => {
                            savePhoto(null);
                            social.publishProfile?.({ photo: null });
                            notify("Foto quitada");
                        }}
                        onSave={(valor) => {
                            if (valor === (displayName ?? "")) return;
                            saveName(valor);
                            social.publishProfile?.({ name: valor || user?.displayName || "Alguien" });
                            notify("Perfil actualizado");
                        }}
                        onClose={close}
                    />
                );
            case "addFriend":
                return (
                    <AddFriendSheet
                        key={id}
                        username={props.username}
                        user={user}
                        enabled={social.enabled}
                        lookup={social.lookup}
                        onLogin={requestLogin}
                        onAdd={() =>
                            social
                                .invite(props.username)
                                .then((nombre) => notify(`Invitación enviada a ${nombre}`))
                                .catch((error) => notify(error.message))
                                .finally(close)
                        }
                        onClose={close}
                    />
                );
            case "joinList":
                return (
                    <JoinListSheet
                        key={id}
                        token={props.token}
                        user={user}
                        enabled={social.enabled}
                        social={social}
                        onLogin={requestLogin}
                        onJoined={(invite) => {
                            setJoiningId(invite.listId);
                            setTab("lists");
                            nav.openList({ kind: "shared", id: invite.listId });
                            notify(`Ya estás en ${invite.name}`);
                        }}
                        onClose={close}
                    />
                );
            case "platforms":
                return <PlatformsSheet key={id} catalog={catalog} platforms={platforms} onToggle={togglePlatform} onClose={close} />;
            case "confirm":
                return <ConfirmSheet key={id} {...props} onClose={close} />;
            case "menu": {
                const item = props.item;
                return (
                    <ActionMenu
                        key={id}
                        title={item.title}
                        subtitle={item.year ? String(item.year) : null}
                        actions={menuActions(props, id)}
                        onClose={close}
                    />
                );
            }
            case "invite": {
                const list = sharedById(props.listId);
                if (!list) return null;
                return (
                    <InviteToListSheet
                        key={id}
                        list={list}
                        friends={social.friends}
                        social={social}
                        onToast={notify}
                        onGoFriends={() => changeTab("friends")}
                        onClose={close}
                    />
                );
            }
            case "listSettings": {
                const list = sharedById(props.listId);
                if (!list) return null;
                return (
                    <ListSettingsSheet
                        key={id}
                        list={list}
                        people={(uid) => people(uid, list)}
                        myUid={user?.uid}
                        social={social}
                        onToast={notify}
                        onInvite={() => nav.swap(id, "invite", { listId: list.id })}
                        onLeave={() => confirmLeave(list)}
                        onClose={close}
                    />
                );
            }
            case "pick": {
                const list = sharedById(props.listId);
                if (!list) return null;
                return (
                    <ListPickSheet
                        key={id}
                        list={list}
                        items={social.listItems[list.id] ?? []}
                        context={seenContext}
                        names={(uid) => (uid === user?.uid ? "tú" : (people(uid, list).name ?? "alguien"))}
                        onOpen={(item) => nav.swap(id, "detail", { item })}
                        onClose={close}
                    />
                );
            }
            default:
                return null;
        }
    }

    /* ===================== Pantallas ===================== */

    function renderListView() {
        if (openedList) {
            return (
                <ListDetail
                    key={openedList.id}
                    list={openedList}
                    myUid={user?.uid ?? null}
                    library={library}
                    libraries={social.libraries}
                    people={(uid) => people(uid, openedList)}
                    actions={listActions(openedList)}
                />
            );
        }
        // Una lista en conjunto abierta desde un link, que no se puede (o aún no se puede) mostrar
        const [title, text] = !social.enabled
            ? ["Entra para ver esta lista", "Las listas en conjunto viven en tu cuenta."]
            : !social.listsReady || joiningId === listView.id
              ? ["Abriendo la lista…", ""]
              : ["No encontré esta lista", "Puede que la hayan borrado o que no estés invitado. Pide que te inviten."];
        return (
            <main className="screen is-detail">
                <header className="detail-bar">
                    <button type="button" className="icon-btn" onClick={nav.closeList} aria-label="Regresar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </header>
                <div className="empty">
                    <b>{title}</b>
                    {text && <p>{text}</p>}
                    {!social.enabled && cloudEnabled && (
                        <button type="button" className="btn btn-primary" onClick={requestLogin}>
                            Entrar con Google
                        </button>
                    )}
                </div>
            </main>
        );
    }

    const current = deck.deck[0];

    return (
        <div className="app">
            <header className="topbar">
                <p className="logo">
                    Qué<span>Veo</span>
                </p>
                <div className="topbar-actions">
                    {/* En celular la lupa de Explorar va aquí; en escritorio está en la barra lateral */}
                    {tab === "explorar" && (
                        <button type="button" className="icon-btn explore-search" onClick={() => nav.open("search")} aria-label="Buscar un título">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ width: 17, height: 17 }}>
                                <circle cx="11" cy="11" r="6.5" />
                                <path d="M16 16l4.5 4.5" />
                            </svg>
                        </button>
                    )}
                    <button type="button" className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Cambiar tema">
                        {theme === "dark" ? "☀" : "☾"}
                    </button>
                </div>
            </header>

            {tab === "explorar" && (
                <ExploreScreen
                    deckType={deckType}
                    onDeckType={setDeckType}
                    taste={taste}
                    deck={deck}
                    genres={genres}
                    ratings={social.ratings}
                    library={library}
                    isDesktop={isDesktop}
                    onDecide={handleDecide}
                    onOpen={(item) => nav.open("detail", { item })}
                    onPoster={(item) => nav.open("poster", { item })}
                    onFriends={(item) => nav.open("who", { item })}
                    onForget={(id) => library[id] && forgetWithUndo(library[id])}
                    friendOpinions={friendOpinions}
                    onShare={social.enabled ? (item) => nav.open("share", { item }) : null}
                    myPlatforms={platforms}
                    onPickPlatforms={goToPlatforms}
                    covered={overlays.length > 0}
                />
            )}

            {tab === "lists" && !listView && (
                <>
                    <ListsScreen
                        lists={lists}
                        sharedLists={social.lists}
                        listItems={social.listItems}
                        context={seenContext}
                        people={people}
                        canShare={social.enabled}
                        onOpenMine={(id) => nav.openList({ kind: "mine", id })}
                        onOpenShared={(list) => nav.openList({ kind: "shared", id: list.id })}
                        onNewShared={() => nav.open("share", { item: null })}
                        onTonight={() => nav.open("tonight")}
                    />
                    <button type="button" className="fab" onClick={() => nav.open("search")} aria-label="Buscar un título">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <circle cx="11" cy="11" r="6.5" />
                            <path d="M16 16l4.5 4.5" />
                        </svg>
                    </button>
                </>
            )}

            {tab === "lists" && listView && renderListView()}

            {tab === "friends" && (
                <FriendsScreen
                    cloudEnabled={cloudEnabled}
                    user={user}
                    social={social}
                    library={library}
                    onLogin={requestLogin}
                    onOpenFriend={(friend) => nav.open("friend", { friend })}
                    onOpenItem={(item) => nav.open("detail", { item })}
                    onToast={notify}
                />
            )}

            {tab === "profile" && (
                <ProfileScreen
                    user={user}
                    cloudEnabled={cloudEnabled}
                    displayName={displayName}
                    photo={photo}
                    stats={stats}
                    platformCatalog={catalog}
                    platforms={platforms}
                    onEditPlatforms={goToPlatforms}
                    onEdit={() => nav.open("profile")}
                    onLogin={requestLogin}
                    onLogout={logout}
                />
            )}
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={handlePhoto} />

            <nav className="tabbar">
                {/* En escritorio el buscador va hasta arriba de la barra lateral */}
                <button type="button" className="tab-search" onClick={() => nav.open("search")}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="6.5" />
                        <path d="M16 16l4.5 4.5" />
                    </svg>
                    Buscar
                </button>
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={tab === item.id ? "is-active" : ""}
                        aria-current={tab === item.id ? "page" : undefined}
                        onClick={() => changeTab(item.id)}
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

            {overlays.map(renderOverlay)}

            {showTips && tab === "explorar" && current && (
                <div
                    className="tips"
                    onClick={() => {
                        setShowTips(false);
                        localStorage.setItem(TIPS_KEY, "1");
                    }}
                >
                    <div className="tips-card">
                        <h2>Así se usa</h2>
                        <ul>
                            <li><span className="tip-key">→</span> Ya la vi · la calificas</li>
                            <li><span className="tip-key">↑</span> Quiero verla</li>
                            <li><span className="tip-key">←</span> No la he visto</li>
                            <li><span className="tip-key">·</span> Un toque abre la ficha</li>
                            <li><span className="tip-key">◉</span> Deja el dedo y ves el póster</li>
                        </ul>
                        <button type="button" className="btn btn-primary btn-wide">Va</button>
                    </div>
                </div>
            )}

            <div className="toast-slot" role="status" aria-live="polite">
                {!authReady && cloudEnabled && <p className="toast">Conectando…</p>}
                {toast && (
                    <p key={toast.id} className="toast" onClick={() => setToast(null)}>
                        {toast.text}
                        {toast.undo && (
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    toast.undo();
                                    setToast(null);
                                }}
                            >
                                Deshacer
                            </button>
                        )}
                    </p>
                )}
            </div>
        </div>
    );
}
