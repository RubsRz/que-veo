import { useState } from "react";
import Sheet from "./Sheet";
import { pickForGroup, votesOf } from "../lib/social";

/** Por qué salió esta, en una línea: quién ya la vio y cuántos votos trae. */
function reason(pick, names) {
    const votes = votesOf(pick);
    const seen = pick.seen.length
        ? `Ya la vio ${pick.seen.map(names).join(", ")}`
        : "Nadie de la lista la ha visto";
    return votes ? `${seen} · ${votes} ${votes === 1 ? "voto" : "votos"}` : seen;
}

/**
 * "¿Qué vemos hoy?" dentro de una lista en conjunto: el dado elige de lo que nadie
 * ha visto, y lo más votado tiene más chance.
 */
export default function ListPickSheet({ list, items, context, names, onOpen, onClose }) {
    const roll = (exclude = null) => pickForGroup(items, list.members, context, { exclude });
    const [pick, setPick] = useState(() => roll());

    return (
        <Sheet
            onClose={onClose}
            title="¿Qué vemos hoy?"
            subtitle={list.name}
            footer={
                pick && (
                    <button type="button" className="btn btn-primary btn-wide" onClick={() => setPick(roll(pick.id) ?? pick)}>
                        Proponme otra
                    </button>
                )
            }
        >
            {pick ? (
                <div className="sheet-head">
                    <span className="poster" style={{ width: 110, flexShrink: 0 }}>
                        {pick.poster ? <img src={pick.poster} alt="" /> : <span className="poster-empty">{pick.title}</span>}
                    </span>
                    <div>
                        <h2>{pick.title}</h2>
                        <p className="sheet-meta">
                            {[pick.year, pick.runtime ? `${pick.runtime} min` : null].filter(Boolean).join(" · ")}
                        </p>
                        <p className="sheet-meta">{reason(pick, names)}</p>
                        <button type="button" className="card-link" style={{ color: "var(--accent)" }} onClick={() => onOpen(pick)}>
                            Ver ficha
                        </button>
                    </div>
                </div>
            ) : (
                <p className="notice">Ya vieron todo lo de esta lista. Agreguen más desde la ficha de cualquier título.</p>
            )}
        </Sheet>
    );
}
