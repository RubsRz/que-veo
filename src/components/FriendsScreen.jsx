import { useState } from "react";
import Avatar from "./Avatar";
import Poster from "./Poster";
import { affinity, trendingAmongFriends } from "../lib/social";

const Icon = ({ path, size = 18 }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, flexShrink: 0 }}>
        <path d={path} />
    </svg>
);

const COPY = "M9 9h10v10H9zM5 15V5h10";
const CHECK = "M5 12.5l4.5 4.5L19 7";
const CROSS = "M6 6l12 12M18 6L6 18";
const PLUS = "M12 5v14M5 12h14";
const SHARE = "M12 16V4m0 0L8 8m4-4l4 4M5 14v4.5a1.5 1.5 0 001.5 1.5h11a1.5 1.5 0 001.5-1.5V14";

/**
 * Pantalla de amigos: tu código, las invitaciones, lo que te recomendaron,
 * qué anda viendo tu círculo y las listas que llevan entre varios.
 */
export default function FriendsScreen({
    cloudEnabled,
    user,
    social,
    library,
    onLogin,
    onOpenFriend,
    onOpenItem,
    onToast,
}) {
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);

    if (!cloudEnabled || !user) {
        return (
            <main className="screen">
                <div className="empty" style={{ marginTop: 40 }}>
                    <b>Esto se pone bueno de a dos</b>
                    <p>
                        Entra con tu cuenta y podrás ver qué le gustó a tus amigos, armar listas juntos y comparar
                        calificaciones.
                    </p>
                    {cloudEnabled && (
                        <button type="button" className="btn btn-primary" onClick={onLogin}>
                            Entrar con Google
                        </button>
                    )}
                </div>
            </main>
        );
    }

    const { profile, blocked, friends, requests, sent, libraries, ratings, recs } = social;

    if (blocked) {
        return (
            <main className="screen">
                <div className="empty" style={{ marginTop: 40 }}>
                    <b>Falta un paso en el servidor</b>
                    <p>
                        Lo de amigos necesita que se publiquen las reglas nuevas de Firestore
                        (<b>npx firebase deploy --only firestore:rules</b>). En cuanto estén, esta pantalla funciona sola.
                    </p>
                </div>
            </main>
        );
    }
    const trending = trendingAmongFriends(ratings, library);

    async function add(event) {
        event.preventDefault();
        if (!code.trim() || busy) return;
        setBusy(true);
        try {
            const name = await social.invite(code);
            onToast(`Invitación enviada a ${name}`);
            setCode("");
        } catch (error) {
            onToast(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function share() {
        const text = `Agrégame en QuéVeo con mi código ${profile?.code}: https://que-veo.netlify.app`;
        try {
            if (navigator.share) await navigator.share({ text });
            else {
                await navigator.clipboard.writeText(text);
                onToast("Código copiado");
            }
        } catch {
            // si cancelan el compartir no hay nada que hacer
        }
    }

    return (
        <main className="screen">
            <section className="code-box">
                <div>
                    <p className="sheet-meta">Tu código</p>
                    <b className="code">{profile?.code ?? "…"}</b>
                </div>
                <button type="button" className="btn btn-ghost" onClick={share}>
                    <Icon path={navigator.share ? SHARE : COPY} /> Compartir
                </button>
            </section>

            <form className="code-form" onSubmit={add}>
                <input
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder="Código de tu amigo (ABC-123)"
                    maxLength={7}
                    aria-label="Código de tu amigo"
                />
                <button type="submit" className="btn btn-primary" disabled={busy}>
                    <Icon path={PLUS} /> Agregar
                </button>
            </form>

            {requests.length > 0 && (
                <>
                    <h3 className="section-title">Te quieren agregar</h3>
                    {requests.map((friend) => (
                        <div key={friend.id} className="friend-row">
                            <Avatar user={{ displayName: friend.name }} photo={friend.photo} />
                            <b>{friend.name}</b>
                            <div className="row-actions">
                                <button
                                    type="button"
                                    className="icon-btn is-yes"
                                    aria-label={`Aceptar a ${friend.name}`}
                                    onClick={() => social.accept(friend).then(() => onToast(`${friend.name} ya es tu amigo`))}
                                >
                                    <Icon path={CHECK} />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    aria-label={`Rechazar a ${friend.name}`}
                                    onClick={() => social.remove(friend)}
                                >
                                    <Icon path={CROSS} />
                                </button>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {recs.length > 0 && (
                <>
                    <h3 className="section-title">Te recomendaron</h3>
                    <div className="grid-cards">
                        {recs.map((item) => (
                            <Poster
                                key={item.id}
                                item={item}
                                note={`${item.from?.name ?? "Un amigo"} te la recomendó`}
                                onClick={() => onOpenItem(item)}
                            />
                        ))}
                    </div>
                </>
            )}

            {trending.length > 0 && (
                <>
                    <h3 className="section-title">Lo que anda viendo tu banda</h3>
                    <div className="grid-cards">
                        {trending.map((row) => (
                            <Poster
                                key={row.id}
                                item={row.item}
                                note={`A ${row.liked} les gustó${row.stars ? ` · ${row.stars}★` : ""}`}
                                onClick={() => onOpenItem(row.item)}
                            />
                        ))}
                    </div>
                </>
            )}

            <h3 className="section-title">Tus amigos · {friends.length}</h3>
            {friends.length === 0 && <p className="notice">Pásale tu código a alguien para empezar.</p>}
            {friends.map((friend) => {
                const match = affinity(library, libraries[friend.uid] ?? {});
                return (
                    <button key={friend.id} type="button" className="friend-row is-button" onClick={() => onOpenFriend(friend)}>
                        <Avatar user={{ displayName: friend.name }} photo={friend.photo} />
                        <span className="grow">
                            <b>{friend.name}</b>
                            <small>
                                {match.score === null
                                    ? "Aún sin títulos en común"
                                    : `${match.score}% de afinidad · coinciden en ${match.agree} de ${match.shared}`}
                            </small>
                        </span>
                        <span className="chevron" aria-hidden="true">›</span>
                    </button>
                );
            })}

            {sent.length > 0 && (
                <>
                    <h3 className="section-title">Invitaciones enviadas</h3>
                    {sent.map((friend) => (
                        <div key={friend.id} className="friend-row">
                            <Avatar user={{ displayName: friend.name }} photo={friend.photo} />
                            <span className="grow">
                                <b>{friend.name}</b>
                                <small>Esperando que acepte</small>
                            </span>
                            <button type="button" className="icon-btn" aria-label="Cancelar" onClick={() => social.remove(friend)}>
                                <Icon path={CROSS} />
                            </button>
                        </div>
                    ))}
                </>
            )}
        </main>
    );
}
