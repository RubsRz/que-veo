import { useRef, useState } from "react";
import Avatar from "./Avatar";
import Sheet from "./Sheet";
import { LIST_COLORS, LIST_EMOJIS, lookOf } from "../lib/listLook";

/**
 * Los ajustes de una lista en conjunto: cómo se llama y cómo se ve, quiénes
 * están (y quién la creó), invitar a más y salirse.
 */
export default function ListSettingsSheet({ list, people, myUid, social, onToast, onInvite, onLeave, onClose }) {
    const look = lookOf(list);
    const [name, setName] = useState(list.name);
    const saved = useRef(list.name); // Enter y luego salir del campo no deben guardar dos veces
    const quien = (uid) => people(uid);

    async function guardar(fields, aviso) {
        try {
            await social.updateList(list, fields);
            if (aviso) onToast(aviso);
        } catch {
            onToast("No se pudo guardar");
        }
    }

    function guardarNombre(event) {
        event?.preventDefault();
        const limpio = name.trim();
        if (!limpio) return setName(list.name);
        if (limpio === saved.current) return;
        saved.current = limpio;
        guardar({ name: limpio }, "Nombre actualizado");
    }

    // El creador primero, luego tú, luego los demás por nombre
    const members = [...list.members].sort(
        (a, b) =>
            (b === list.createdBy) - (a === list.createdBy) ||
            (b === myUid) - (a === myUid) ||
            (quien(a).name ?? "").localeCompare(quien(b).name ?? ""),
    );

    return (
        <Sheet
            onClose={onClose}
            title="Ajustes de la lista"
            footer={
                <button type="button" className="btn btn-ghost btn-wide is-danger" onClick={onLeave}>
                    {list.members.length <= 1 ? "Borrar la lista" : "Salirme de la lista"}
                </button>
            }
        >
            <form onSubmit={guardarNombre}>
                <label className="field-label" htmlFor="nombre-lista">
                    Nombre
                </label>
                <input
                    id="nombre-lista"
                    className="field-input"
                    value={name}
                    maxLength={40}
                    onChange={(event) => setName(event.target.value)}
                    onBlur={guardarNombre}
                />
            </form>

            <h3 className="section-title">Cómo se ve</h3>
            <div className="emoji-grid" role="radiogroup" aria-label="Emoji de la lista">
                {LIST_EMOJIS.map((emoji) => (
                    <button
                        key={emoji}
                        type="button"
                        role="radio"
                        aria-checked={look.emoji === emoji}
                        className={look.emoji === emoji ? "is-on" : ""}
                        onClick={() => guardar({ emoji })}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
            <div className="swatches" role="radiogroup" aria-label="Color de la lista">
                {LIST_COLORS.map((color) => (
                    <button
                        key={color.id}
                        type="button"
                        role="radio"
                        aria-checked={look.color === color.value}
                        aria-label={color.id}
                        className={look.color === color.value ? "is-on" : ""}
                        style={{ "--swatch": color.value }}
                        onClick={() => guardar({ color: color.value })}
                    />
                ))}
            </div>

            <div className="section-head">
                <h3 className="section-title">
                    {list.members.length} {list.members.length === 1 ? "persona" : "personas"}
                </h3>
                <button type="button" className="btn btn-ghost btn-small" onClick={onInvite}>
                    + Invitar
                </button>
            </div>
            {members.map((uid) => (
                <div key={uid} className="friend-row">
                    <Avatar user={{ displayName: quien(uid).name ?? "?" }} photo={quien(uid).photo} />
                    <span className="grow">
                        <b>
                            {quien(uid).name ?? "Alguien"}
                            {uid === myUid ? " (tú)" : ""}
                        </b>
                        {uid === list.createdBy && <small>Creó la lista</small>}
                    </span>
                </div>
            ))}
        </Sheet>
    );
}
