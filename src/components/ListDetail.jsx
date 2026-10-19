import { useMemo, useState } from "react";
import Avatar from "./Avatar";
import Poster from "./Poster";
import { groupSharedItems, votesOf } from "../lib/social";
import { lookOf } from "../lib/listLook";
import { useLongPress } from "../lib/useLongPress";
import { matchesQuery } from "../lib/text";

/**
 * Orden y dirección van juntos en un solo selector: "Más antiguas" se entiende
 * solo, "Recientes + Menor primero" había que pensarlo.
 */
const SORTS = [
    { id: "recent", label: "Recientes", by: (a, b, at) => at(b).localeCompare(at(a)) },
    { id: "oldest", label: "Más antiguas", by: (a, b, at) => at(a).localeCompare(at(b)) },
    { id: "best", label: "Mejor calificadas", rated: true, by: (a, b) => (b.stars ?? 0) - (a.stars ?? 0) || (b.rating ?? 0) - (a.rating ?? 0) },
    { id: "worst", label: "Peor calificadas", rated: true, by: (a, b) => (a.stars ?? 0) - (b.stars ?? 0) || (a.rating ?? 0) - (b.rating ?? 0) },
    { id: "votes", label: "Más votadas", shared: true, by: (a, b, at) => votesOf(b) - votesOf(a) || at(b).localeCompare(at(a)) },
    { id: "newest", label: "Estrenos más nuevos", by: (a, b) => (b.year ?? 0) - (a.year ?? 0) },
    { id: "older", label: "Estrenos más viejos", by: (a, b) => (a.year ?? 9999) - (b.year ?? 9999) },
    { id: "az", label: "Nombre A → Z", by: (a, b) => (a.title ?? "").localeCompare(b.title ?? "") },
    { id: "za", label: "Nombre Z → A", by: (a, b) => (b.title ?? "").localeCompare(a.title ?? "") },
];

const DOTS = "M6 12h.01M12 12h.01M18 12h.01";
const CHECK = "M5 12.5l4.5 4.5L19 7";
const THUMB = "M7 11v9H4v-9zM7 11l4-7a2 2 0 012 2v4h5.5a2 2 0 012 2.3l-1.2 6A2 2 0 0117.3 20H7";
const CHEVRON = "M9 6l6 6-6 6";

const Icon = ({ path, size = 16, width = 2.2 }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: size, height: size, flexShrink: 0 }}>
        <path d={path} />
    </svg>
);

/** "hoy", "ayer", "hace 3 días": para saber cuándo se quitó algo. */
const ago = (iso) => {
    const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
    if (days <= 0) return "hoy";
    if (days === 1) return "ayer";
    return `hace ${days} días`;
};

/** Un póster de la cuadrícula: un toque abre la ficha, dejar el dedo (o ⋯) abre el menú. */
function Tile({ item, onOpen, onMenu, children, faces = null }) {
    const press = useLongPress(onMenu);
    return (
        <div className="tile">
            <div className="tile-poster" {...press}>
                <Poster item={item} onClick={onOpen} />
                {faces}
                <button type="button" className="tile-more" aria-label={`Opciones de ${item.title}`} onClick={onMenu}>
                    <span>
                        <Icon path={DOTS} size={18} width={3} />
                    </span>
                </button>
            </div>
            {children}
        </div>
    );
}

/** El buscador de la lista: filtra mientras escribes, sin acentos ni mayúsculas. */
function ListSearch({ value, onChange, total, found, name }) {
    return (
        <div className="list-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l4.5 4.5" />
            </svg>
            <input
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => event.key === "Escape" && value && (event.stopPropagation(), onChange(""))}
                placeholder={`Buscar en ${name}`}
                aria-label={`Buscar en ${name}`}
                enterKeyHint="search"
            />
            {value && (
                <>
                    <span className="list-search-count" aria-live="polite">
                        {found} de {total}
                    </span>
                    <button type="button" className="list-search-clear" onClick={() => onChange("")} aria-label="Borrar búsqueda">
                        <Icon path="M6 6l12 12M18 6L6 18" size={14} />
                    </button>
                </>
            )}
        </div>
    );
}

/** Cuando la búsqueda no encuentra nada en la lista: ofrece buscar en todo el catálogo. */
function NoMatches({ query, onCatalog }) {
    return (
        <div className="empty">
            <b>Nada con “{query.trim()}” en esta lista</b>
            <p>Revisa cómo está escrito, o búscala en todo el catálogo.</p>
            <button type="button" className="btn btn-ghost" onClick={() => onCatalog(query.trim())}>
                Buscar “{query.trim()}” en el catálogo
            </button>
        </div>
    );
}

/** Una sección que se puede plegar: "Ya vistas", "Quitadas". */
function Fold({ title, count, open, onToggle, children, hint = null }) {
    return (
        <section className="fold">
            <button type="button" className="fold-head" aria-expanded={open} onClick={onToggle}>
                <span className={`fold-chevron ${open ? "is-open" : ""}`}>
                    <Icon path={CHEVRON} size={16} />
                </span>
                <b>{title}</b>
                <small>{count}</small>
            </button>
            {open && (
                <>
                    {hint && <p className="sheet-meta fold-hint">{hint}</p>}
                    {children}
                </>
            )}
        </section>
    );
}

/**
 * Una lista por dentro, a pantalla completa: tuya o en conjunto.
 *
 * En las de conjunto nada desaparece: lo que falta va arriba, lo visto se archiva
 * en "Ya vistas" y lo quitado pasa un tiempo en "Quitadas" por si fue sin querer.
 * La palomita y el voto están debajo de cada póster, con texto; quitar de la lista
 * vive en el menú (⋯ o dejar el dedo), lejos de lo que se toca a diario.
 */
export default function ListDetail({ list, myUid, library, libraries, people, actions }) {
    const shared = list.kind === "shared";
    const rated = !shared && (list.id === "liked" || list.id === "disliked");
    const [sort, setSort] = useState("recent");
    const [scope, setScope] = useState("group"); // qué cuenta como visto: todos o yo
    const [starFilter, setStarFilter] = useState(null); // puntaje exacto; null = todos
    const [showWatched, setShowWatched] = useState(false);
    const [showRemoved, setShowRemoved] = useState(false);
    const [query, setQuery] = useState("");
    const searching = query.trim().length > 0;
    const found = useMemo(() => list.items.filter((item) => matchesQuery(item, query)), [list.items, query]);

    const members = useMemo(() => (shared ? (list.members ?? []) : []), [shared, list.members]);
    const context = useMemo(() => ({ myUid, mine: library, libraries }), [myUid, library, libraries]);
    const sorts = SORTS.filter((option) => (option.rated ? rated : true) && (option.shared ? shared : true));
    const order = sorts.find((option) => option.id === sort) ?? sorts[0];
    const at = (item) => (shared ? item.addedAt : item.updatedAt) ?? "";
    const arrange = (items) => [...items].sort((a, b) => order.by(a, b, at));

    /** Los puntajes que de verdad existen en esta lista, con cuántas hay de cada uno. */
    const starOptions = useMemo(() => {
        if (list.id !== "liked" || shared) return [];
        const counts = new Map();
        for (const item of list.items) {
            const key = item.stars ?? 0;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[0] - a[0]).map(([value, count]) => ({ value, count }));
    }, [shared, list.id, list.items]);

    const groups = useMemo(
        () => (shared ? groupSharedItems(found, members, context, { scope }) : null),
        [shared, found, members, context, scope],
    );

    const header = shared ? <SharedHeader list={list} groups={groups} people={people} actions={actions} /> : <MineHeader list={list} actions={actions} />;

    const sortSelect = (
        <label className="sort-select">
            <span className="visually-hidden">Ordenar</span>
            <select value={order.id} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar">
                {sorts.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );

    if (!shared) {
        const visible = arrange(starFilter === null ? found : found.filter((item) => (item.stars ?? 0) === starFilter));
        return (
            <main className="screen is-detail">
                {header}
                {list.items.length > 1 && (
                    <ListSearch value={query} onChange={setQuery} total={list.items.length} found={found.length} name={list.name.toLowerCase()} />
                )}
                {starOptions.length > 1 && (
                    <div className="chips chips-scroll">
                        <button type="button" className={`chip ${starFilter === null ? "is-on" : ""}`} aria-pressed={starFilter === null} onClick={() => setStarFilter(null)}>
                            Todas · {list.items.length}
                        </button>
                        {starOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`chip ${starFilter === option.value ? "is-on" : ""}`}
                                aria-pressed={starFilter === option.value}
                                onClick={() => setStarFilter(option.value)}
                            >
                                {option.value ? `${option.value}★` : "Sin calificar"} · {option.count}
                            </button>
                        ))}
                    </div>
                )}
                {list.items.length > 1 && <div className="list-controls">{sortSelect}</div>}

                {visible.length === 0 && searching ? (
                    <NoMatches query={query} onCatalog={actions.searchCatalog} />
                ) : visible.length === 0 ? (
                    <div className="empty">
                        <b>Nada aquí todavía</b>
                        <p>Califica títulos en Explorar y van cayendo solos.</p>
                    </div>
                ) : (
                    <div className="grid-cards grid-big">
                        {visible.map((item) => (
                            <Tile key={item.id} item={item} onOpen={() => actions.openItem(item)} onMenu={() => actions.menu(item)} />
                        ))}
                    </div>
                )}
            </main>
        );
    }

    const { pending, watched, removed } = groups;
    const total = pending.length + watched.length;
    const activeCount = list.items.filter((item) => !item.removedAt).length;
    // Buscando, lo que encontró no se queda escondido en una sección plegada
    const watchedOpen = showWatched || searching || (pending.length === 0 && watched.length > 0);
    const removedOpen = showRemoved || searching;

    const sharedTile = (item) => {
        const mineSeen = item.seen.includes(myUid);
        const voted = Boolean(item.votes?.[myUid]);
        const votes = votesOf(item);
        const others = item.seen.filter((uid) => uid !== myUid);
        return (
            <Tile
                key={item.id}
                // Las estrellas que se ven son las tuyas, nunca las de quien la agregó
                item={{ ...item, stars: library[item.id]?.stars ?? null }}
                onOpen={() => actions.openItem(item)}
                onMenu={() => actions.menu(item)}
                faces={
                    others.length > 0 && (
                        <span className="tile-faces" aria-label={`La vio ${others.map((uid) => people(uid).name ?? "alguien").join(", ")}`}>
                            {others.slice(0, 3).map((uid) => (
                                <Avatar key={uid} user={{ displayName: people(uid).name ?? "?" }} photo={people(uid).photo} />
                            ))}
                        </span>
                    )
                }
            >
                <p className="tile-meta">{item.addedBy?.uid === myUid ? "La pusiste tú" : `La puso ${item.addedBy?.name ?? "alguien"}`}</p>
                <div className="tile-actions">
                    <button
                        type="button"
                        className={`tile-btn ${mineSeen ? "is-on" : ""}`}
                        aria-pressed={mineSeen}
                        onClick={() => actions.toggleWatched(item, mineSeen)}
                    >
                        <Icon path={CHECK} size={15} width={2.6} />
                        {mineSeen ? "Vista" : "La vi"}
                    </button>
                    <button
                        type="button"
                        className={`tile-btn is-vote ${voted ? "is-on" : ""}`}
                        aria-pressed={voted}
                        aria-label={`${voted ? "Quitar mi voto" : "Votar para verla"}${votes ? ` (${votes})` : ""}`}
                        onClick={() => actions.vote(item, !voted)}
                    >
                        <Icon path={THUMB} size={15} width={1.9} />
                        {votes > 0 && <span>{votes}</span>}
                    </button>
                </div>
            </Tile>
        );
    };

    return (
        <main className="screen is-detail">
            {header}

            {activeCount > 1 && (
                <ListSearch value={query} onChange={setQuery} total={activeCount} found={total} name={list.name} />
            )}

            {pending.length > 0 && !searching && (
                <button type="button" className="tonight-btn is-compact" onClick={() => actions.pick()}>
                    <span aria-hidden="true">🎲</span>
                    <span>
                        ¿Qué vemos hoy?
                        <small>Elijo de lo que nadie ha visto, y lo más votado tiene más chance</small>
                    </span>
                </button>
            )}

            {total > 0 && (
                <div className="list-controls">
                    <div className="segmented" role="group" aria-label="Qué cuenta como vista">
                        <button type="button" className={scope === "group" ? "is-active" : ""} aria-pressed={scope === "group"} onClick={() => setScope("group")}>
                            Del grupo
                        </button>
                        <button type="button" className={scope === "me" ? "is-active" : ""} aria-pressed={scope === "me"} onClick={() => setScope("me")}>
                            Solo yo
                        </button>
                    </div>
                    {total > 1 && sortSelect}
                </div>
            )}

            {total === 0 && searching ? (
                <NoMatches query={query} onCatalog={actions.searchCatalog} />
            ) : total === 0 ? (
                <div className="empty">
                    <b>Nada aquí todavía</b>
                    <p>Abre la ficha de una película y usa “Compartir” para echarla a esta lista.</p>
                </div>
            ) : (
                <>
                    <h3 className="section-title">
                        {scope === "group" ? "Por ver" : "Me faltan"} <small className="count">{pending.length}</small>
                    </h3>
                    {pending.length === 0 && searching ? (
                        <p className="sheet-meta">Ninguna por ver con ese nombre.</p>
                    ) : pending.length === 0 ? (
                        <p className="notice">
                            {scope === "group" ? "Ya vieron todo lo de esta lista 🎉" : "Ya viste todo lo de esta lista 🎉"} Agreguen más
                            desde la ficha de cualquier título.
                        </p>
                    ) : (
                        <div className="grid-cards grid-big">{arrange(pending).map(sharedTile)}</div>
                    )}

                    {watched.length > 0 && (
                        <Fold
                            title={scope === "group" ? "Ya las vieron todos" : "Ya las vi"}
                            count={watched.length}
                            open={watchedOpen}
                            onToggle={() => setShowWatched(!watchedOpen)}
                        >
                            <div className="grid-cards grid-big is-archive">{arrange(watched).map(sharedTile)}</div>
                        </Fold>
                    )}
                </>
            )}

            {removed.length > 0 && (
                <Fold
                    title="Quitadas"
                    count={removed.length}
                    open={removedOpen}
                    onToggle={() => setShowRemoved(!removedOpen)}
                    hint="Se pueden regresar durante 30 días."
                >
                    <ul className="removed-list">
                        {removed.map((item) => (
                            <li key={item.id}>
                                <span className="removed-poster">{item.poster ? <img src={item.poster} alt="" loading="lazy" /> : null}</span>
                                <span className="grow">
                                    <b>{item.title}</b>
                                    <small>
                                        {item.removedBy?.uid === myUid ? "La quitaste tú" : `La quitó ${item.removedBy?.name ?? "alguien"}`} {ago(item.removedAt)}
                                    </small>
                                </span>
                                <button type="button" className="btn btn-ghost btn-small" onClick={() => actions.restore(item)}>
                                    Regresar
                                </button>
                                <button type="button" className="icon-btn is-small" aria-label={`Opciones de ${item.title}`} onClick={() => actions.removedMenu(item)}>
                                    <Icon path={DOTS} size={18} width={3} />
                                </button>
                            </li>
                        ))}
                    </ul>
                </Fold>
            )}
        </main>
    );
}

function BackButton({ onBack }) {
    return (
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Regresar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19l-7-7 7-7" />
            </svg>
        </button>
    );
}

function MineHeader({ list, actions }) {
    return (
        <header className="detail-bar">
            <BackButton onBack={actions.back} />
            <div className="detail-bar-text">
                <h2>{list.name}</h2>
                <p className="sheet-meta">
                    {list.items.length} {list.items.length === 1 ? "título" : "títulos"}
                </p>
            </div>
        </header>
    );
}

function SharedHeader({ list, groups, people, actions }) {
    const look = lookOf(list);
    const members = list.members ?? [];
    return (
        <header className="detail-bar">
            <BackButton onBack={actions.back} />
            <button type="button" className="detail-bar-text is-button" onClick={actions.settings} aria-label={`Ajustes de ${list.name}`}>
                <h2>
                    <span className="list-emoji" style={{ "--list-color": look.color }} aria-hidden="true">
                        {look.emoji}
                    </span>
                    <span className="detail-bar-name">{list.name}</span>
                </h2>
                <p className="sheet-meta">
                    {groups.pending.length} por ver · {groups.watched.length} {groups.watched.length === 1 ? "vista" : "vistas"}
                </p>
            </button>
            <div className="members">
                <button type="button" className="members-stack" onClick={actions.settings} aria-label={`${members.length} personas en la lista`}>
                    {members.slice(0, 3).map((uid) => (
                        <span key={uid} className="member">
                            <Avatar user={{ displayName: people(uid).name ?? "?" }} photo={people(uid).photo} />
                        </span>
                    ))}
                    {members.length > 3 && <span className="member is-more">+{members.length - 3}</span>}
                </button>
                <button type="button" className="member is-add" onClick={actions.invite} aria-label="Invitar a alguien">
                    +
                </button>
            </div>
        </header>
    );
}
