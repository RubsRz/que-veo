import { useState } from "react";
import Avatar from "./Avatar";

/**
 * Hoja para compartir un título: mandárselo a un amigo o echarlo a una lista
 * en conjunto. Sin título (`item` en null) sirve para crear una lista nueva.
 */
export default function ShareSheet({ item, friends, lists, social, onClose, onToast }) {
    const [name, setName] = useState("");
    const [invited, setInvited] = useState([]);
    const [creating, setCreating] = useState(!item);
    const [busy, setBusy] = useState(false);

    const toggle = (friend) =>
        setInvited((current) =>
            current.includes(friend.uid) ? current.filter((uid) => uid !== friend.uid) : [...current, friend.uid],
        );

    async function createList(event) {
        event.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        try {
            const listId = await social.createList(
                name.trim(),
                friends.filter((friend) => invited.includes(friend.uid)),
            );
            if (item) await social.addToList(listId, item);
            onToast(item ? `“${item.title}” va en ${name.trim()}` : `Lista “${name.trim()}” creada`);
            onClose();
        } catch {
            onToast("No se pudo crear la lista");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="sheet" onClick={onClose}>
            <div className="sheet-card" onClick={(event) => event.stopPropagation()}>
                <h2>{item ? "Compartir" : "Nueva lista en conjunto"}</h2>
                {item && <p className="sheet-meta">{item.title}</p>}

                {item && friends.length > 0 && (
                    <>
                        <h3 className="section-title">Recomendársela a</h3>
                        <div className="chips">
                            {friends.map((friend) => (
                                <button
                                    key={friend.uid}
                                    type="button"
                                    className="chip"
                                    onClick={() =>
                                        social
                                            .recommend(item, friend)
                                            .then(() => onToast(`Se la mandaste a ${friend.name}`))
                                            .then(onClose)
                                            .catch(() => onToast("No se pudo mandar"))
                                    }
                                >
                                    <Avatar user={{ displayName: friend.name }} photo={friend.photo} />
                                    {friend.name}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {item && (
                    <>
                        <h3 className="section-title">Agregar a una lista</h3>
                        {lists.length === 0 && !creating && <p className="notice">Todavía no tienes listas en conjunto.</p>}
                        <div className="chips">
                            {lists.map((list) => (
                                <button
                                    key={list.id}
                                    type="button"
                                    className="chip"
                                    onClick={() =>
                                        social
                                            .addToList(list.id, item)
                                            .then(() => onToast(`Va en ${list.name}`))
                                            .then(onClose)
                                            .catch(() => onToast("No se pudo agregar"))
                                    }
                                >
                                    <span className="list-dot" aria-hidden="true" />
                                    {list.name}
                                </button>
                            ))}
                            {!creating && (
                                <button type="button" className="chip is-ghost" onClick={() => setCreating(true)}>
                                    + Nueva lista
                                </button>
                            )}
                        </div>
                    </>
                )}

                {creating && (
                    <form onSubmit={createList} style={{ marginTop: 14 }}>
                        <input
                            className="field-input"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Nombre de la lista (Maratón, Terror, Con la novia…)"
                            maxLength={40}
                            aria-label="Nombre de la lista"
                            autoFocus
                        />
                        {friends.length > 0 && (
                            <>
                                <h3 className="section-title">Con quién</h3>
                                <div className="chips">
                                    {friends.map((friend) => (
                                        <button
                                            key={friend.uid}
                                            type="button"
                                            className={`chip ${invited.includes(friend.uid) ? "is-on" : ""}`}
                                            onClick={() => toggle(friend)}
                                        >
                                            <Avatar user={{ displayName: friend.name }} photo={friend.photo} />
                                            {friend.name}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                        <button type="submit" className="btn btn-primary btn-wide" disabled={busy || !name.trim()} style={{ marginTop: 12 }}>
                            Crear lista
                        </button>
                    </form>
                )}

                <div className="sheet-actions">
                    <button type="button" className="btn btn-ghost btn-wide" onClick={onClose}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
