import { useEffect, useState } from "react";
import { getDetails } from "../lib/tmdb";

const DECISION_LABEL = {
    liked: "Ya la vi y me gustó",
    disliked: "La vi y no me gustó",
    watchlist: "Pendiente por ver",
    skipped: "No me interesa",
};

/** Ficha completa: sinopsis, reparto, dónde verla, calificación y acciones. */
export default function DetailSheet({ item, entry, onClose, onDecide, onForget }) {
    const [details, setDetails] = useState(null);
    const [stars, setStars] = useState(entry?.stars ?? 0);

    useEffect(() => {
        let alive = true;
        getDetails(item.type, item.tmdbId)
            .then((data) => alive && setDetails(data))
            .catch(() => alive && setDetails(null));
        return () => {
            alive = false;
        };
    }, [item]);

    const full = details ?? item;
    const stream = (full.providers ?? []).filter((provider) => provider.mode === "flatrate");
    const paid = (full.providers ?? []).filter((provider) => provider.mode !== "flatrate");

    function rate(value) {
        setStars(value);
        onDecide(full, "liked", value);
    }

    return (
        <div className="sheet" onClick={onClose}>
            <div className="sheet-card" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-head">
                    <span className="poster" style={{ aspectRatio: "2/3" }}>
                        {full.poster ? <img src={full.poster} alt="" /> : <span className="poster-empty">{full.title}</span>}
                    </span>
                    <div>
                        <h2>{full.title}</h2>
                        <p className="sheet-meta">
                            {[full.year, full.runtime ? `${full.runtime} min` : null, full.seasons ? `${full.seasons} temporadas` : null, full.rating ? `★ ${full.rating}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                        {full.director && <p className="sheet-meta">Dirige: {full.director}</p>}
                        {entry && <p className="sheet-meta">En tus listas: <b>{DECISION_LABEL[entry.decision]}</b></p>}
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
                        {full.link && (
                            <a className="card-link" href={full.link} target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>
                                Ver opciones en JustWatch
                            </a>
                        )}
                    </>
                )}

                <h3 className="section-title">Tu calificación</h3>
                <div className="stars">
                    {[1, 2, 3, 4, 5].map((value) => (
                        <button
                            key={value}
                            type="button"
                            className={value <= stars ? "is-on" : ""}
                            onClick={() => rate(value)}
                            aria-label={`${value} estrellas`}
                        >
                            ★
                        </button>
                    ))}
                </div>

                <div className="sheet-actions">
                    <button type="button" className="btn btn-primary" onClick={() => onDecide(full, "liked", stars || null)}>
                        👍 Me gustó
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => onDecide(full, "watchlist")}>
                        🕑 Pendiente
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => onDecide(full, "disliked")}>
                        👎 No me gustó
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => onDecide(full, "skipped")}>
                        🚫 No me interesa
                    </button>
                    {entry && (
                        <button type="button" className="btn btn-ghost btn-wide" onClick={() => onForget(full.id)}>
                            Quitar de mis listas
                        </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-wide" onClick={onClose}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
