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
const SEARCH = "M11 4.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM16 16l4.5 4.5";
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
    const [encontrado, setEncontrado] = useState(null);
    const [buscando, setBuscando] = useState(false);
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
            setEncontrado(null);
        } catch (error) {
            onToast(error.message);
        } finally {
            setBusy(false);
        }
    }

    /** Se busca mientras escribes, para ver a quién vas a agregar. */
    async function buscar(valor) {
        setCode(valor);
        setEncontrado(null);
        if (valor.replace(/[^a-z0-9._-]/gi, "").length < 3) {
            setBuscando(false);
            return;
        }
        setBuscando(true);
        const encontrada = await social.lookup(valor).catch(() => null);
        setBuscando(false);
        if (encontrada && encontrada.username !== profile?.username) setEncontrado(encontrada);
    }

    /** Si ya hay algo con esa persona, el botón lo dice en vez de invitar de nuevo. */
    function estadoCon(uid) {
        if (friends.some((friend) => friend.uid === uid)) return "Ya son amigos";
        if (sent.some((friend) => friend.uid === uid)) return "Invitación enviada";
        if (requests.some((friend) => friend.uid === uid)) return "Te invitó: acéptalo abajo";
        return null;
    }

    async function copiar() {
        try {
            await navigator.clipboard.writeText(`https://que-veo.netlify.app/?u=${profile?.username}`);
            onToast("Link copiado");
        } catch {
            onToast("No se pudo copiar");
        }
    }

    async function share() {
        const text = `Agrégame en QuéVeo: https://que-veo.netlify.app/?u=${profile?.username}`;
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
            <section className="me-card">
                <div className="me-top">
                    <Avatar user={{ displayName: profile?.name }} photo={profile?.photo} />
                    <div className="me-text">
                        <b>{profile?.name ?? "Tú"}</b>
                        <span className="me-user">@{profile?.username ?? "…"}</span>
                    </div>
                </div>
                <div className="me-actions">
                    <button type="button" className="btn btn-primary" onClick={share}>
                        <Icon path={navigator.share ? SHARE : COPY} size={17} />
                        Compartir mi link
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={copiar} aria-label="Copiar mi link">
                        <Icon path={COPY} size={17} />
                    </button>
                </div>
            </section>

            <form className="search-friend" onSubmit={add} role="search">
                <Icon path={SEARCH} size={17} />
                <input
                    value={code}
                    onChange={(event) => buscar(event.target.value.toLowerCase())}
                    placeholder="Buscar por usuario"
                    maxLength={21}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    enterKeyHint="search"
                    aria-label="Buscar a un amigo por su usuario"
                />
                {code && (
                    <button
                        type="button"
                        className="search-clear"
                        onClick={() => {
                            setCode("");
                            setEncontrado(null);
                        }}
                        aria-label="Limpiar"
                    >
                        <Icon path={CROSS} size={14} />
                    </button>
                )}
            </form>

            {buscando && <p className="search-state">Buscando…</p>}

            {!buscando && code.length >= 3 && !encontrado && (
                <p className="search-state">No hay nadie con ese usuario</p>
            )}

            {encontrado && (
                <div className="friend-row">
                    <Avatar user={{ displayName: encontrado.name }} photo={encontrado.photo} />
                    <span className="grow">
                        <b>{encontrado.name ?? "Alguien"}</b>
                        <small>@{encontrado.username}</small>
                    </span>
                    {estadoCon(encontrado.uid) ? (
                        <span className="row-state">{estadoCon(encontrado.uid)}</span>
                    ) : (
                        <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={add}>
                            <Icon path={PLUS} size={15} /> Agregar
                        </button>
                    )}
                </div>
            )}

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
                            <div key={item.id} className="grid-item">
                                <Poster
                                    item={item}
                                    note={`${item.from?.name ?? "Un amigo"} te la recomendó`}
                                    onClick={() => onOpenItem(item)}
                                />
                                <div className="grid-actions">
                                    <button
                                        type="button"
                                        className="tick is-remove"
                                        aria-label={`Quitar la recomendación de ${item.title}`}
                                        onClick={() => social.dismissRec(item).then(() => onToast("Recomendación quitada"))}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                            <path d="M6 6l12 12M18 6L6 18" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
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
            {friends.length === 0 && <p className="notice">Busca a alguien por su usuario o pásale tu link.</p>}
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
