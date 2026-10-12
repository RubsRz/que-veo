import { useState } from "react";
import { tonightPick } from "../lib/taste";
import Poster from "./Poster";

const TIMES = [
    { value: 0, label: "El tiempo que sea" },
    { value: 100, label: "Menos de 1 h 40" },
    { value: 120, label: "Menos de 2 h" },
    { value: 150, label: "Menos de 2 h 30" },
];

/** "¿Qué vemos hoy?": filtra tus pendientes por tiempo y plataforma y propone una. */
export default function Tonight({ watchlist, providers, onClose, onOpen }) {
    const [maxMinutes, setMaxMinutes] = useState(0);
    const [providerId, setProviderId] = useState(0);
    const [pick, setPick] = useState(null);
    const [searched, setSearched] = useState(false);

    function roll() {
        setPick(tonightPick(watchlist, { maxMinutes: maxMinutes || null, providerId: providerId || null }));
        setSearched(true);
    }

    return (
        <div className="sheet" onClick={onClose}>
            <div className="sheet-card" onClick={(event) => event.stopPropagation()}>
                <h2>¿Qué vemos hoy?</h2>
                <p className="sheet-meta">De tus {watchlist.length} pendientes, una que se acomode a tu rato.</p>

                <div className="filters-row">
                    <label className="field">
                        Cuánto tiempo tienes
                        <select value={maxMinutes} onChange={(event) => setMaxMinutes(Number(event.target.value))}>
                            {TIMES.map((time) => (
                                <option key={time.value} value={time.value}>{time.label}</option>
                            ))}
                        </select>
                    </label>
                    {providers.length > 0 && (
                        <label className="field">
                            Dónde quieres verla
                            <select value={providerId} onChange={(event) => setProviderId(Number(event.target.value))}>
                                <option value={0}>Cualquier plataforma</option>
                                {providers.map((provider) => (
                                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                                ))}
                            </select>
                        </label>
                    )}
                </div>

                {pick ? (
                    <>
                        <h3 className="section-title">Te propongo</h3>
                        <div className="sheet-head">
                            <span className="poster" style={{ width: 96, flexShrink: 0 }}>
                                {pick.poster ? <img src={pick.poster} alt="" /> : <span className="poster-empty">{pick.title}</span>}
                            </span>
                            <div>
                                <h2>{pick.title}</h2>
                                <p className="sheet-meta">
                                    {[pick.year, pick.runtime ? `${pick.runtime} min` : null, pick.rating ? `★ ${pick.rating}` : null]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                                <button type="button" className="card-link" style={{ color: "var(--accent)" }} onClick={() => onOpen(pick)}>
                                    Ver ficha
                                </button>
                            </div>
                        </div>
                    </>
                ) : searched ? (
                    <p className="notice">Nada de tu lista cumple con esos filtros. Prueba con más tiempo u otra plataforma.</p>
                ) : null}

                <div className="sheet-actions">
                    <button type="button" className="btn btn-primary btn-wide" onClick={roll}>
                        🎲 {pick ? "Proponme otra" : "Elegir por mí"}
                    </button>
                    <button type="button" className="btn btn-ghost btn-wide" onClick={onClose}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
