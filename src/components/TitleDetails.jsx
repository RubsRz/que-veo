import { useEffect, useState } from "react";
import { getDetails } from "../lib/tmdb";
import Avatar from "./Avatar";
import Stars from "./Stars";
import { ratingInfo } from "../lib/ratings";
import { accessLabel, groupProviders } from "../lib/platforms";

/** Tu decisión actual, como etiqueta de color arriba de la ficha. */
const STATUS = {
    liked: { label: "Ya la viste", tone: "seen" },
    disliked: { label: "Ya la viste", tone: "seen" },
    watchlist: { label: "Quieres verla", tone: "watch" },
    skipped: { label: "No la has visto", tone: "skip" },
};

// Cuántas plataformas se ven antes de "Ver más": las tuyas siempre se ven
const PROVIDER_LIMIT = 4;

const CHECK = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 15, height: 15 }}>
        <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
);

/** Cómo se lee la opinión de un amigo: manda la calificación. */
const friendLabel = (opinion) => {
    if (opinion.decision === "watchlist") return "quiere verla";
    if (!opinion.stars) return "ya la vio";
    return opinion.stars >= 3 ? "le gustó" : "no le latió";
};

/**
 * Ficha de un título. Se usa igual en la hoja de celular y en el panel lateral
 * de escritorio, para no tener dos versiones del mismo contenido.
 */
export default function TitleDetails({
    item,
    entry,
    onDecide,
    onForget,
    showActions = true,
    friendOpinions = [],
    onShare = null,
    hideTitle = false,
    myPlatforms = [],
    onPickPlatforms = null,
}) {
    const [details, setDetails] = useState(null);
    const [stars, setStars] = useState(entry?.stars ?? 0);
    const [allProviders, setAllProviders] = useState(false);

    useEffect(() => {
        setDetails(null);
        setStars(entry?.stars ?? 0);
        setAllProviders(false);
        let alive = true;
        getDetails(item.type, item.tmdbId)
            .then((data) => alive && setDetails(data))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const full = details ?? item;
    const groups = groupProviders(full.providers ?? [], myPlatforms);
    const yours = groups.filter((group) => group.mine && group.included);
    const limit = Math.max(PROVIDER_LIMIT, groups.filter((group) => group.mine).length);
    const shown = allProviders ? groups : groups.slice(0, limit);
    const status = entry ? STATUS[entry.decision] : null;

    return (
        <>
            <div className="sheet-head">
                <span className="poster" style={{ width: 96, flexShrink: 0 }}>
                    {full.poster ? <img src={full.poster} alt="" /> : <span className="poster-empty">{full.title}</span>}
                </span>
                <div>
                    {!hideTitle && <h2>{full.title}</h2>}
                    <p className="sheet-meta">
                        {[
                            full.year,
                            full.runtime ? `${full.runtime} min` : null,
                            full.seasons ? `${full.seasons} temporadas` : null,
                            full.rating ? `★ ${full.rating}` : null,
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                    {full.director && <p className="sheet-meta">Dirige: {full.director}</p>}
                    {status && (
                        <p className={`status-pill is-${status.tone}`}>
                            {CHECK}
                            {status.label}
                            {entry.stars ? ` · ${entry.stars}★` : ""}
                        </p>
                    )}
                </div>
            </div>

            {full.overview && <p className="overview">{full.overview}</p>}

            {full.cast?.length > 0 && (
                <p className="sheet-meta" style={{ marginTop: 10 }}>
                    Con {full.cast.map((person) => person.name).join(", ")}
                </p>
            )}

            {groups.length > 0 && (
                <>
                    <h3 className="section-title">Dónde verla en México</h3>
                    {yours.length > 0 && (
                        <p className="yours-line">
                            {CHECK}
                            {yours.length === 1
                                ? `Está en ${yours[0].name}, que ya tienes`
                                : `Está en ${yours.length} plataformas que ya tienes`}
                        </p>
                    )}
                    <div className="providers">
                        {shown.map((group) => (
                            <span key={group.key} className={`provider ${group.mine ? "is-mine" : ""}`}>
                                {group.logo && <img src={group.logo} alt="" />}
                                {group.name}
                                {accessLabel(group) && <small>{accessLabel(group)}</small>}
                                {group.mine && <span className="visually-hidden"> (la tienes)</span>}
                            </span>
                        ))}
                        {groups.length > shown.length && (
                            <button type="button" className="provider is-more" onClick={() => setAllProviders(true)}>
                                +{groups.length - shown.length} más
                            </button>
                        )}
                    </div>
                    {myPlatforms.length === 0 && onPickPlatforms && (
                        <button type="button" className="link-btn is-inline" onClick={onPickPlatforms}>
                            Marca las plataformas que tienes para verlas resaltadas
                        </button>
                    )}
                </>
            )}

            {friendOpinions.length > 0 && (
                <>
                    <h3 className="section-title">Qué dicen tus amigos</h3>
                    <ul className="friend-opinions">
                        {friendOpinions.map((opinion) => (
                            <li key={opinion.uid} className={`is-${opinion.decision}`}>
                                <Avatar user={{ displayName: opinion.name }} photo={opinion.photo} />
                                <span>
                                    <b>{opinion.name}</b> {friendLabel(opinion)}
                                </span>
                                {opinion.stars ? <em>{opinion.stars}★</em> : null}
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {showActions && (
                <>
                    <h3 className="section-title">Tu calificación</h3>
                    <Stars value={stars} size={36} onDraft={setStars} onChange={setStars} />
                    {ratingInfo(stars) && (
                        <p className="stars-label" style={{ textAlign: "center" }}>
                            <b>{ratingInfo(stars).title}</b> · {ratingInfo(stars).hint}
                        </p>
                    )}
                    {stars > 0 && stars !== (entry?.stars ?? 0) && (
                        <button
                            type="button"
                            className="btn btn-primary btn-wide"
                            style={{ marginTop: 10 }}
                            onClick={() => onDecide(full, "liked", stars)}
                        >
                            Guardar {stars}★
                        </button>
                    )}

                    <div className="sheet-actions">
                        {[
                            { decision: "watchlist", label: "Quiero verla" },
                            { decision: "skipped", label: "No la he visto" },
                        ].map((option) => {
                            const current = entry?.decision === option.decision;
                            return (
                                <button
                                    key={option.decision}
                                    type="button"
                                    className={`btn btn-ghost ${current ? "is-current" : ""}`}
                                    aria-pressed={current}
                                    // Ya está ahí: tocarla otra vez no hace nada (para quitarla está "Quitar de mis listas")
                                    onClick={() => !current && onDecide(full, option.decision)}
                                >
                                    {current && CHECK}
                                    {option.label}
                                </button>
                            );
                        })}
                        {onShare && (
                            <button type="button" className="btn btn-ghost btn-wide" onClick={() => onShare(full)}>
                                Compartir con un amigo
                            </button>
                        )}
                        {entry && onForget && (
                            <button type="button" className="btn btn-ghost btn-wide" onClick={() => onForget(full.id)}>
                                Quitar de mis listas
                            </button>
                        )}
                    </div>
                </>
            )}
        </>
    );
}
