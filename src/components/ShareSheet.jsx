import { useState } from "react";
import Avatar from "./Avatar";
import Sheet from "./Sheet";
import { lookOf } from "../lib/listLook";

const ADDED = {
    added: (item, list) => `“${item.title}” va en ${list.name}`,
    already: (item, list) => `Ya estaba en ${list.name}`,
    restored: (item, list) => `Regresó a ${list.name}`,
};

/**
 * Hoja para compartir un título: mandárselo a un amigo o echarlo a una lista
 * en conjunto. Sin título (`item` en null) sirve para crear una lista nueva.
 */
export default function ShareSheet({ item, friends, lists, listItems = {}, social, onClose, onToast }) {
    /** Si el título ya está (y nadie lo quitó) en esa lista, para no ofrecerla como nueva. */
    const isIn = (list) => (listItems[list.id] ?? []).some((entry) => entry.id === item?.id && !entry.removedAt);
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
            onClose(item ? null : listId);
        } catch {
            onToast("No se pudo crear la lista");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Sheet onClose={onClose} title={item ? "Compartir" : "Nueva lista en conjunto"} subtitle={item?.title}>
            <>

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
                                    className={`chip ${isIn(list) ? "is-on" : ""}`}
                                    disabled={isIn(list)}
                                    onClick={() =>
                                        social
                                            .addToList(list.id, item)
                                            .then((result) => onToast(ADDED[result](item, list)))
                                            .then(onClose)
                                            .catch(() => onToast("No se pudo agregar"))
                                    }
                                >
                                    <span className="list-dot" style={{ background: lookOf(list).color }} aria-hidden="true">
                                        {lookOf(list).emoji}
                                    </span>
                                    {list.name}
                                    {isIn(list) && <small> · ya está</small>}
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

            </>
        </Sheet>
    );
}
