import { useMemo, useState } from "react";
import Avatar from "./Avatar";
import Poster from "./Poster";
import { sortSharedItems } from "../lib/social";
import { useSharedItems } from "../lib/friends";

const ORDERS = [
    { id: "recent", label: "Recientes" },
    { id: "stars", label: "Mejor calificadas" },
    { id: "year", label: "Más nuevas" },
    { id: "title", label: "A-Z" },
];

const SHARED_FILTERS = [
    { id: "pending", label: "Por ver" },
    { id: "watched", label: "Ya vistas" },
    { id: "all", label: "Todas" },
];

const sorters = {
    recent: (a, b) => (b.updatedAt ?? b.addedAt ?? "").localeCompare(a.updatedAt ?? a.addedAt ?? ""),
    stars: (a, b) => (b.stars ?? 0) - (a.stars ?? 0) || (b.rating ?? 0) - (a.rating ?? 0),
    year: (a, b) => (b.year ?? 0) - (a.year ?? 0),
    title: (a, b) => (a.title ?? "").localeCompare(b.title ?? ""),
};

/**
 * Una lista por dentro, a pantalla completa: tuya o en conjunto.
 * Encabezado fijo con el botón de regresar, orden, y los pósters en cuadrícula.
 */
export default function ListDetail({ list, onBack, onOpenItem, social, friends = [], onToast, onInvite }) {
    // El perfil en vivo manda sobre la copia que guardó la lista al crearse
    const quien = (uid) => social?.profiles?.[uid] ?? list.profiles?.[uid] ?? {};
    const [order, setOrder] = useState("recent");
    const [asc, setAsc] = useState(false); // de menor a mayor
    const [filter, setFilter] = useState("pending");
    const [starFilter, setStarFilter] = useState(null); // puntaje exacto; null = todos
    const shared = list.kind === "shared";
    const rated = !shared && list.id === "liked";
    const liveItems = useSharedItems(shared ? list.id : null);

    /** Los puntajes que de verdad existen en esta lista, con cuántas hay de cada uno. */
    const starOptions = useMemo(() => {
        if (!rated) return [];
        const counts = new Map();
        for (const item of list.items) {
            const key = item.stars ?? 0;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[0] - a[0]).map(([value, count]) => ({ value, count }));
    }, [rated, list.items]);

    const items = useMemo(() => {
        const base = shared ? sortSharedItems(liveItems) : list.items;
        let filtered = shared
            ? base.filter((item) => (filter === "all" ? true : filter === "watched" ? item.watched : !item.watched))
            : base;
        if (rated && starFilter !== null) filtered = filtered.filter((item) => (item.stars ?? 0) === starFilter);
        const sorted = [...filtered].sort(sorters[order]);
        return asc ? sorted.reverse() : sorted;
    }, [shared, rated, liveItems, list.items, filter, starFilter, order, asc]);

    const pending = shared ? liveItems.filter((item) => !item.watched).length : null;
    const members = shared ? list.members ?? [] : [];
    const invitable = friends.filter((friend) => !members.includes(friend.uid));

    return (
        <main className="screen is-detail">
            <header className="detail-bar">
                <button type="button" className="icon-btn" onClick={onBack} aria-label="Regresar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="detail-bar-text">
                    <h2>{list.name}</h2>
                    <p className="sheet-meta">
                        {shared
                            ? `${pending} por ver · ${liveItems.length - pending} ya vistas`
                            : `${list.items.length} ${list.items.length === 1 ? "título" : "títulos"}`}
                    </p>
                </div>
                {shared && (
                    <div className="members">
                        {members.slice(0, 3).map((uid) => (
                            <span key={uid} className="member" title={quien(uid).name}>
                                <Avatar user={{ displayName: quien(uid).name ?? "?" }} photo={quien(uid).photo} />
                            </span>
                        ))}
                        {invitable.length > 0 && (
                            <button type="button" className="member is-add" onClick={onInvite} aria-label="Invitar a alguien">
                                +
                            </button>
                        )}
                    </div>
                )}
            </header>

            {rated && starOptions.length > 1 && (
                <div className="chips chips-scroll">
                    <button
                        type="button"
                        className={`chip ${starFilter === null ? "is-on" : ""}`}
                        onClick={() => setStarFilter(null)}
                    >
                        Todas · {list.items.length}
                    </button>
                    {starOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`chip ${starFilter === option.value ? "is-on" : ""}`}
                            onClick={() => setStarFilter(option.value)}
                        >
                            {option.value ? `${option.value}★` : "Sin calificar"} · {option.count}
                        </button>
                    ))}
                </div>
            )}

            <div className="chips chips-scroll">
                {shared &&
                    SHARED_FILTERS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`chip ${filter === item.id ? "is-on" : ""}`}
                            onClick={() => setFilter(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                {ORDERS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={`chip ${order === item.id ? "is-on" : ""}`}
                        onClick={() => setOrder(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
                <button
                    type="button"
                    className="chip is-direction"
                    onClick={() => setAsc(!asc)}
                    aria-label={asc ? "Cambiar a mayor primero" : "Cambiar a menor primero"}
                    title={asc ? "De menor a mayor" : "De mayor a menor"}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, transform: asc ? "rotate(180deg)" : "" }}>
                        <path d="M12 5v14M6 13l6 6 6-6" />
                    </svg>
                    {asc ? "Menor primero" : "Mayor primero"}
                </button>
            </div>

            {items.length === 0 ? (
                <div className="empty">
                    <b>Nada aquí todavía</b>
                    <p>
                        {shared
                            ? "Abre la ficha de una película y usa “Compartir” para echarla a esta lista."
                            : "Califica títulos en Explorar y van cayendo solos."}
                    </p>
                </div>
            ) : (
                <div className="grid-cards grid-big">
                    {items.map((item) => (
                        <div key={item.id} className={`grid-item ${item.watched ? "is-watched" : ""}`}>
                            <Poster
                                item={item}
                                note={shared ? `La puso ${item.addedBy?.name ?? "alguien"}` : null}
                                onClick={() => onOpenItem(item)}
                            />
                            {shared && (
                                <div className="grid-actions">
                                    <button
                                        type="button"
                                        className="tick"
                                        aria-label={item.watched ? "Marcar como no vista" : "Marcar como vista"}
                                        onClick={() => social.markWatched(list.id, item, !item.watched)}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M5 12.5l4.5 4.5L19 7" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        className="tick is-remove"
                                        aria-label={`Quitar ${item.title}`}
                                        onClick={() =>
                                            social.removeFromList(list.id, item.id).then(() => onToast("Quitada de la lista"))
                                        }
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                            <path d="M6 6l12 12M18 6L6 18" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {shared && (
                <button
                    type="button"
                    className="btn btn-ghost btn-wide is-danger"
                    style={{ marginTop: 18 }}
                    onClick={() => social.leaveList(list).then(onBack)}
                >
                    {members.length <= 1 ? "Borrar la lista" : "Salirme de la lista"}
                </button>
            )}
        </main>
    );
}
