import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import Sheet from "./Sheet";

/** Cuando abres un link de invitación: "¿quieres agregar a ...?" */
export default function AddFriendSheet({ username, user, enabled, lookup, onAdd, onLogin, onClose }) {
    // Se busca a quién te quieren presentar en cuanto hay sesión
    const [person, setPerson] = useState(null);
    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        lookup(username)
            .then((found) => alive && setPerson(found))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [enabled, username]); // eslint-disable-line react-hooks/exhaustive-deps

    const nombre = person?.name ?? `@${username}`;

    return (
        <Sheet onClose={onClose} title="Te quieren en su banda" subtitle={`@${username}`}>
            <div className="profile-editor">
                <span className="profile-photo">
                    <Avatar user={{ displayName: nombre }} photo={person?.photo} />
                </span>
                <p className="stars-title" style={{ marginTop: 14 }}>
                    {user ? `¿Quieres agregar a ${nombre}?` : `Entra con tu cuenta para agregar a ${nombre}`}
                </p>
                <p className="stars-label">
                    {user
                        ? "Verán lo que calificó cada quien y podrán armar listas juntos."
                        : "Sin cuenta no se pueden tener amigos, porque no hay dónde guardar sus listas."}
                </p>

                <div style={{ display: "grid", gap: 10, width: "100%", marginTop: 20 }}>
                    {user ? (
                        <button type="button" className="btn btn-primary btn-wide" onClick={onAdd}>
                            Agregar a {nombre}
                        </button>
                    ) : (
                        <button type="button" className="btn btn-primary btn-wide" onClick={onLogin}>
                            Entrar con Google
                        </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-wide" onClick={onClose}>
                        Ahora no
                    </button>
                </div>
            </div>
        </Sheet>
    );
}
