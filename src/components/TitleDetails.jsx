import { useEffect, useState } from "react";
import { getDetails } from "../lib/tmdb";

const DECISION_LABEL = {
    liked: "Ya la vi y me gustó",
    disliked: "La vi y no me gustó",
    watchlist: "Pendiente por ver",
    skipped: "No me interesa",
};

/**
 * Ficha de un título. Se usa igual en la hoja de celular y en el panel lateral
 * de escritorio, para no tener dos versiones del mismo contenido.
 */
export default function TitleDetails({ item, entry, onDecide, onForget, showActions = true }) {
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
                    <h2>{full.title}</h2>
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

            {showActions && (
                <>
                    <h3 className="section-title">Tu calificación</h3>
                    <div className="stars">
                        {[1, 2, 3, 4, 5].map((value) => (
                            <button
                                key={value}
                                type="button"
                                className={value <= stars ? "is-on" : ""}
                                onClick={() => {
                                    setStars(value);
                                    onDecide(full, "liked", value);
                                }}
                                aria-label={`${value} estrellas`}
                            >
                                ★
                            </button>
                        ))}
                    </div>

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
