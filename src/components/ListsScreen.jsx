import Avatar from "./Avatar";

const MINE = [
    { id: "liked", label: "Me gustaron", hint: "Las que ya viste y te latieron" },
    { id: "watchlist", label: "Pendientes", hint: "Las que quieres ver" },
    { id: "disliked", label: "No me gustaron", hint: "Las que viste y no" },
    { id: "skipped", label: "Descartadas", hint: "Las que no te llamaron" },
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

/** Índice de listas: las tuyas y las que llevas con alguien más. */
export default function ListsScreen({ lists, sharedLists, onOpenMine, onOpenShared, onNewShared, onTonight, canShare }) {
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
                {MINE.map((item) => (
                    <button key={item.id} type="button" className="list-card" onClick={() => onOpenMine(item.id)}>
                        <Stack items={lists[item.id]} />
                        <span className="list-card-text">
                            <b>{item.label}</b>
                            <small>
                                {lists[item.id].length
                                    ? `${lists[item.id].length} ${lists[item.id].length === 1 ? "título" : "títulos"}`
                                    : item.hint}
                            </small>
                        </span>
                    </button>
                ))}
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
                    Un “pendientes” compartido: cualquiera agrega títulos y todos ven lo que falta por ver.
                </p>
            ) : (
                sharedLists.map((list) => (
                    <button key={list.id} type="button" className="friend-row is-button" onClick={() => onOpenShared(list)}>
                        <span className="list-dot" aria-hidden="true" />
                        <span className="grow">
                            <b>{list.name}</b>
                            <small>{list.members.map((uid) => list.profiles?.[uid]?.name ?? "Alguien").join(" · ")}</small>
                        </span>
                        <span className="members">
                            {list.members.slice(0, 3).map((uid) => (
                                <span key={uid} className="member">
                                    <Avatar
                                        user={{ displayName: list.profiles?.[uid]?.name ?? "?" }}
                                        photo={list.profiles?.[uid]?.photo}
                                    />
                                </span>
                            ))}
                        </span>
                    </button>
                ))
            )}
        </main>
    );
}
