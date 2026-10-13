import { useState } from "react";
import Avatar from "./Avatar";
import Sheet from "./Sheet";
import Poster from "./Poster";
import { affinity, watchTogether } from "../lib/social";

const TABS = [
    { id: "both", label: "Pendientes de los dos" },
    { id: "fromThem", label: "Te recomienda" },
    { id: "forThem", label: "Recomiéndale" },
];

const EMPTY = {
    both: "Ninguno de los dos tiene algo pendiente en común. Guarden pendientes y aquí aparecen.",
    fromThem: "Todavía no hay nada que le haya encantado y tú no hayas visto.",
    forThem: "Cuando califiques con 4★ o más algo que esa persona no ha visto, te lo sugiero aquí.",
};

/** Ficha de un amigo: qué tanto coinciden y qué podrían ver juntos. */
export default function FriendSheet({ friend, mine, theirs, onClose, onOpenItem, onRecommend, onRemove }) {
    const [tab, setTab] = useState("both");
    const match = affinity(mine, theirs);
    const groups = watchTogether(mine, theirs);
    const list = groups[tab];

    return (
        <Sheet
            onClose={onClose}
            title={friend.name}
            footer={
                <button type="button" className="btn btn-ghost btn-wide is-danger" onClick={() => onRemove(friend)}>
                    Dejar de ser amigos
                </button>
            }
        >
            <>
                <div className="sheet-head">
                    <Avatar user={{ displayName: friend.name }} photo={friend.photo} />
                    <div>
                        <h2>{friend.name}</h2>
                        <p className="sheet-meta">
                            {match.score === null
                                ? "Aún no tienen suficientes títulos en común"
                                : `${match.score}% de afinidad · coinciden en ${match.agree} de ${match.shared}`}
                        </p>
                    </div>
                </div>

                {match.score !== null && (
                    <div className="affinity-bar" role="img" aria-label={`${match.score} por ciento de afinidad`}>
                        <span style={{ width: `${match.score}%` }} />
                    </div>
                )}

                <div className="list-tabs" style={{ marginTop: 14 }}>
                    {TABS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={tab === item.id ? "is-active" : ""}
                            onClick={() => setTab(item.id)}
                        >
                            {item.label} · {groups[item.id].length}
                        </button>
                    ))}
                </div>

                {list.length === 0 ? (
                    <p className="notice">{EMPTY[tab]}</p>
                ) : (
                    <div className="grid-cards" style={{ marginTop: 12 }}>
                        {list.map((item) => (
                            <Poster
                                key={item.id}
                                item={item}
                                note={tab === "forThem" ? "Mándasela" : item.stars ? `Le dio ${item.stars}★` : null}
                                onClick={() => (tab === "forThem" ? onRecommend(item, friend) : onOpenItem(item))}
                            />
                        ))}
                    </div>
                )}

            </>
        </Sheet>
    );
}
