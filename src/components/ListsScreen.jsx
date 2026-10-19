import { useMemo } from "react";
import Avatar from "./Avatar";
import { splitRated } from "../lib/ratings";
import { groupSharedItems } from "../lib/social";
import { lookOf } from "../lib/listLook";

const MINE = [
    { id: "liked", label: "Me gustaron", hint: "Las que calificaste con 3★ o más" },
    { id: "watchlist", label: "Quiero verlas", hint: "Tus pendientes" },
    { id: "disliked", label: "No me gustaron", hint: "Las que calificaste bajo" },
    { id: "skipped", label: "No las he visto", hint: "Las que pasaste de largo" },
];

/** Tres pósters encimados, como lomo de la lista. */
function Stack({ items }) {
    if (!items.length) return <span className="stack is-empty" aria-hidden="true" />;
    return (
        <span className="stack" aria-hidden="true">
            {items.slice(0, 3).map((item, index) =>
                item.poster ? (
                    <img key={item.id} src={item.poster} alt="" loading="lazy" style={{ zIndex: 3 - index }} />
                ) : (
                    <i key={item.id} style={{ zIndex: 3 - index }} />
                ),
            )}
        </span>
    );
}

/** Índice de listas: las tuyas y las que llevas con alguien más, con el mismo peso. */
export default function ListsScreen({ lists, sharedLists, listItems = {}, context, onOpenMine, onOpenShared, onNewShared, onTonight, canShare, people }) {
    // Lo calificado se parte por la nota; lo demás va tal cual. Se calcula una vez.
    const mine = useMemo(() => {
        const rated = splitRated(lists);
        return { ...lists, liked: rated.liked, disliked: rated.disliked };
    }, [lists]);

    return (
        <main className="screen">
            <button type="button" className="tonight-btn" onClick={onTonight}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24, flexShrink: 0 }}>
                    <path d="M7 9l1.4 10.5h7.2L17 9zM7 9c0-2 1.4-3 2.5-3S11 7 12 7s1.4-1 2.5-1S17 7 17 9" />
                </svg>
                <span>
                    ¿Qué vemos hoy?
                    <small>Te elijo una de tus {lists.watchlist.length} pendientes o de las novedades</small>
                </span>
            </button>

            <h3 className="section-title">Tus listas</h3>
            <div className="list-grid">
                {MINE.map((item) => {
                    const count = mine[item.id].length;
                    return (
                        <button key={item.id} type="button" className="list-card" onClick={() => onOpenMine(item.id)}>
                            <Stack items={mine[item.id]} />
                            <span className="list-card-text">
                                <b>{item.label}</b>
                                <small>{count ? `${count} ${count === 1 ? "título" : "títulos"}` : item.hint}</small>
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="section-head">
                <h3 className="section-title">Listas en conjunto</h3>
                {canShare && (
                    <button type="button" className="btn btn-ghost btn-small" onClick={onNewShared}>
                        + Nueva
                    </button>
                )}
            </div>

            {!canShare ? (
                <p className="notice">Entra con tu cuenta para armar listas con tus amigos.</p>
            ) : sharedLists.length === 0 ? (
                <p className="notice">
                    Un “pendientes” compartido: cualquiera agrega títulos, cada quien palomea lo que ya vio y el dado elige
                    qué ver juntos.
                </p>
            ) : (
                <div className="list-grid">
                    {sharedLists.map((list) => (
                        <SharedCard key={list.id} list={list} items={listItems[list.id]} context={context} people={people} onOpen={() => onOpenShared(list)} />
                    ))}
                </div>
            )}
        </main>
    );
}

function SharedCard({ list, items, context, people, onOpen }) {
    const look = lookOf(list);
    const groups = useMemo(() => groupSharedItems(items ?? [], list.members, context), [items, list.members, context]);
    const pending = groups.pending.length;
    const status = items === undefined ? "Cargando…" : pending ? `${pending} por ver` : groups.watched.length ? "Ya vieron todo" : "Vacía";

    return (
        <button type="button" className="list-card is-shared" style={{ "--list-color": look.color }} onClick={onOpen}>
            <Stack items={groups.pending.length ? groups.pending : groups.watched} />
            <span className="list-card-text">
                <b>
                    <span aria-hidden="true">{look.emoji} </span>
                    {list.name}
                </b>
                <small>{status}</small>
                <span className="members is-mini" aria-label={list.members.map((uid) => people(uid, list).name ?? "Alguien").join(", ")}>
                    {list.members.slice(0, 4).map((uid) => (
                        <span key={uid} className="member">
                            <Avatar user={{ displayName: people(uid, list).name ?? "?" }} photo={people(uid, list).photo} />
                        </span>
                    ))}
                    {list.members.length > 4 && <span className="member is-more">+{list.members.length - 4}</span>}
                </span>
            </span>
        </button>
    );
}
