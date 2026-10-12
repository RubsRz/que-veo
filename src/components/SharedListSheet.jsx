import { useState } from "react";
import Avatar from "./Avatar";
import { sortSharedItems } from "../lib/social";
import { useSharedItems } from "../lib/friends";

/** Una lista en conjunto: lo que falta por ver y lo que ya cayó. */
export default function SharedListSheet({ list, friends, social, onClose, onOpenItem, onToast }) {
    const [adding, setAdding] = useState(false);
    const items = sortSharedItems(useSharedItems(list.id));
    const pending = items.filter((item) => !item.watched);
    const invitable = friends.filter((friend) => !list.members.includes(friend.uid));

    return (
        <div className="sheet" onClick={onClose}>
            <div className="sheet-card" onClick={(event) => event.stopPropagation()}>
                <h2>{list.name}</h2>
                <p className="sheet-meta">
                    {pending.length} por ver · {items.length - pending.length} ya vistas
                </p>

                <div className="members">
                    {list.members.map((uid) => (
                        <span key={uid} className="member" title={list.profiles?.[uid]?.name}>
                            <Avatar
                                user={{ displayName: list.profiles?.[uid]?.name ?? "?" }}
                                photo={list.profiles?.[uid]?.photo}
                            />
                        </span>
                    ))}
                    {invitable.length > 0 && (
                        <button type="button" className="member is-add" onClick={() => setAdding(!adding)} aria-label="Invitar a alguien">
                            +
                        </button>
                    )}
                </div>

                {adding && (
                    <div className="invite-row">
                        {invitable.map((friend) => (
                            <button
                                key={friend.uid}
                                type="button"
                                className="btn btn-ghost btn-small"
                                onClick={() =>
                                    social.inviteToList(list, friend).then(() => {
                                        onToast(`${friend.name} ya está en la lista`);
                                        setAdding(false);
                                    })
                                }
                            >
                                {friend.name}
                            </button>
                        ))}
                    </div>
                )}

                {items.length === 0 ? (
                    <p className="notice">
                        Todavía no hay nada. Abre la ficha de una película y usa “Agregar a una lista”.
                    </p>
                ) : (
                    <ul className="shared-items">
                        {items.map((item) => (
                            <li key={item.id} className={item.watched ? "is-watched" : ""}>
                                <button
                                    type="button"
                                    className="tick"
                                    aria-label={item.watched ? "Marcar como no vista" : "Marcar como vista"}
                                    onClick={() => social.markWatched(list.id, item, !item.watched)}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12.5l4.5 4.5L19 7" />
                                    </svg>
                                </button>
                                <button type="button" className="shared-title" onClick={() => onOpenItem(item)}>
                                    {item.poster && <img src={item.poster} alt="" loading="lazy" />}
                                    <span>
                                    <b>{item.title}</b>
                                    <small>
                                        {item.year ? `${item.year} · ` : ""}
                                        La puso {item.addedBy?.name ?? "alguien"}
                                    </small>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    aria-label={`Quitar ${item.title}`}
                                    onClick={() => social.removeFromList(list.id, item.id)}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                                        <path d="M6 6l12 12M18 6L6 18" />
                                    </svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="sheet-actions">
                    <button type="button" className="btn btn-ghost btn-wide" onClick={onClose}>
                        Cerrar
                    </button>
                    <button
                        type="button"
                        className="btn btn-ghost btn-wide is-danger"
                        onClick={() => social.leaveList(list).then(onClose)}
                    >
                        {list.members.length <= 1 ? "Borrar la lista" : "Salirme de la lista"}
                    </button>
                </div>
            </div>
        </div>
    );
}
