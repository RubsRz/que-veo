import { useState } from "react";
import Avatar from "./Avatar";
import Sheet from "./Sheet";

/**
 * Sumar gente a una lista que ya existe: tus amigos de un toque, y para quien
 * todavía no es tu amigo, un link. La hoja no se cierra al invitar a uno, para
 * poder meter a varios seguidos.
 */
export default function InviteToListSheet({ list, friends, social, onToast, onGoFriends, onClose }) {
    const [busy, setBusy] = useState(null);
    const fuera = friends.filter((friend) => !list.members.includes(friend.uid));

    async function invitar(friend) {
        setBusy(friend.uid);
        try {
            await social.inviteToList(list, friend);
            onToast(`${friend.name} ya está en ${list.name}`);
        } catch {
            onToast("No se pudo invitar");
        } finally {
            setBusy(null);
        }
    }

    async function compartirLink() {
        setBusy("link");
        try {
            const url = await social.inviteLink(list);
            const texto = `Únete a “${list.name}” en QuéVeo`;
            if (navigator.share) {
                await navigator.share({ title: list.name, text: texto, url }).catch(() => {});
            } else {
                await navigator.clipboard.writeText(url);
                onToast("Link copiado");
            }
        } catch {
            onToast("No se pudo crear el link");
        } finally {
            setBusy(null);
        }
    }

    return (
        <Sheet onClose={onClose} title="Invitar a la lista" subtitle={list.name}>
            <h3 className="section-title">Tus amigos</h3>
            {friends.length === 0 ? (
                <div className="notice">
                    Todavía no tienes amigos en la app. Agrégalos por su usuario o pásales el link de abajo.
                    <button type="button" className="link-btn" onClick={onGoFriends}>
                        Ir a Amigos
                    </button>
                </div>
            ) : fuera.length === 0 ? (
                <p className="notice">Todos tus amigos ya están en esta lista.</p>
            ) : (
                fuera.map((friend) => (
                    <div key={friend.uid} className="friend-row">
                        <Avatar user={{ displayName: friend.name }} photo={friend.photo} />
                        <span className="grow">
                            <b>{friend.name}</b>
                        </span>
                        <button
                            type="button"
                            className="btn btn-primary btn-small"
                            disabled={busy === friend.uid}
                            onClick={() => invitar(friend)}
                        >
                            {busy === friend.uid ? "…" : "Invitar"}
                        </button>
                    </div>
                ))
            )}

            <h3 className="section-title">Con un link</h3>
            <p className="sheet-meta">Quien lo abra entra directo a la lista, aunque no sea tu amigo.</p>
            <button type="button" className="btn btn-ghost btn-wide" style={{ marginTop: 10, width: "100%" }} disabled={busy === "link"} onClick={compartirLink}>
                {busy === "link" ? "Creando link…" : "Compartir link de invitación"}
            </button>
        </Sheet>
    );
}
