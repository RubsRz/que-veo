import { useEffect, useState } from "react";
import { getDetails } from "../lib/tmdb";
import Avatar from "./Avatar";
import Stars from "./Stars";

const DECISION_LABEL = {
    liked: "Ya la vi y me gustó",
    disliked: "La vi y no me gustó",
    watchlist: "Pendiente por ver",
    skipped: "No me interesa",
};

/** Cómo se lee la opinión de un amigo en la ficha. */
const FRIEND_LABEL = {
    liked: "le gustó",
    disliked: "no le gustó",
    watchlist: "la tiene pendiente",
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
}) {
    const [details, setDetails] = useState(null);
    const [stars, setStars] = useState(entry?.stars ?? 0);

    useEffect(() => {
        setDetails(null);
        setStars(entry?.stars ?? 0);
        let alive = true;
        getDetails(item.type, item.tmdbId)
            .then((data) => alive && setDetails(data))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const full = details ?? item;
    const stream = (full.providers ?? []).filter((provider) => provider.mode === "flatrate");
    const paid = (full.providers ?? []).filter((provider) => provider.mode !== "flatrate");

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
                    {entry && (
                        <p className="sheet-meta">
                            En tus listas: <b>{DECISION_LABEL[entry.decision]}</b>
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

            {(stream.length > 0 || paid.length > 0) && (
                <>
                    <h3 className="section-title">Dónde verla en México</h3>
                    <div className="providers">
                        {stream.map((provider) => (
                            <span key={`${provider.id}-${provider.mode}`} className="provider">
                                {provider.logo && <img src={provider.logo} alt="" />}
                                {provider.name}
                            </span>
                        ))}
                        {paid.slice(0, 4).map((provider) => (
                            <span key={`${provider.id}-${provider.mode}`} className="provider">
                                {provider.logo && <img src={provider.logo} alt="" />}
                                {provider.name} <small>{provider.mode === "rent" ? "renta" : "compra"}</small>
                            </span>
                        ))}
                    </div>
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
                                    <b>{opinion.name}</b> {FRIEND_LABEL[opinion.decision]}
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
                    <Stars
                        value={stars}
                        size={36}
                        onChange={(value) => {
                            setStars(value);
                            onDecide(full, "liked", value);
                        }}
                    />

                    <div className="sheet-actions">
                        <button type="button" className="btn btn-primary" onClick={() => onDecide(full, "liked", stars || null)}>
                            Me gustó
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => onDecide(full, "watchlist")}>
                            Pendiente
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => onDecide(full, "disliked")}>
                            No me gustó
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => onDecide(full, "skipped")}>
                            No me interesa
                        </button>
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
