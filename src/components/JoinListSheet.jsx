import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import { lookOf } from "../lib/listLook";

/** Cuando abres un link de invitación a una lista: "¿te unes a ...?" */
export default function JoinListSheet({ token, user, enabled, social, onLogin, onJoined, onClose }) {
    const [invite, setInvite] = useState(undefined); // undefined = buscando, null = no existe
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        social
            .lookupListInvite(token)
            .then((found) => alive && setInvite(found))
            .catch(() => alive && setInvite(null));
        return () => {
            alive = false;
        };
    }, [enabled, token]); // eslint-disable-line react-hooks/exhaustive-deps

    const yaEstoy = invite && social.lists.some((list) => list.id === invite.listId);

    async function unirme() {
        setBusy(true);
        setError(null);
        try {
            if (!yaEstoy) await social.joinList(invite);
            onJoined(invite);
        } catch {
            setError("No se pudo entrar. Puede que el link ya no sirva: pide uno nuevo.");
            setBusy(false);
        }
    }

    const nombre = invite ? `${lookOf(invite).emoji} ${invite.name}` : "una lista";

    return (
        <Sheet onClose={onClose} title="Te invitaron a una lista">
            <div className="profile-editor">
                {!user ? (
                    <>
                        <p className="stars-title">Entra con tu cuenta para unirte</p>
                        <p className="stars-label">Las listas en conjunto viven en tu cuenta, para verlas en todos lados.</p>
                    </>
                ) : invite === undefined ? (
                    <p className="stars-label">Buscando la lista…</p>
                ) : invite === null ? (
                    <>
                        <p className="stars-title">Este link ya no sirve</p>
                        <p className="stars-label">Puede que hayan borrado la lista. Pide que te inviten otra vez.</p>
                    </>
                ) : (
                    <>
                        <p className="join-emoji" aria-hidden="true">
                            {lookOf(invite).emoji}
                        </p>
                        <p className="stars-title">{yaEstoy ? `Ya estás en ${invite.name}` : `¿Te unes a ${invite.name}?`}</p>
                        <p className="stars-label">
                            Te invita {invite.by?.name ?? "alguien"}. Van a ver qué agregas y qué ya viste de la lista; tus
                            calificaciones siguen siendo tuyas.
                        </p>
                    </>
                )}
                {error && <p className="notice">{error}</p>}

                <div style={{ display: "grid", gap: 10, width: "100%", marginTop: 20 }}>
                    {!user ? (
                        <button type="button" className="btn btn-primary btn-wide" onClick={onLogin}>
                            Entrar con Google
                        </button>
                    ) : (
                        invite && (
                            <button type="button" className="btn btn-primary btn-wide" disabled={busy} onClick={unirme}>
                                {busy ? "Entrando…" : yaEstoy ? "Abrir la lista" : `Unirme a ${nombre}`}
                            </button>
                        )
                    )}
                    <button type="button" className="btn btn-ghost btn-wide" onClick={onClose}>
                        Ahora no
                    </button>
                </div>
            </div>
        </Sheet>
    );
}
