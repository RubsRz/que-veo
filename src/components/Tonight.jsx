import { useState } from "react";
import { tonightPick } from "../lib/taste";

/** Dado, para el botón que elige por ti. */
const Dice = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" style={{ width: 18, height: 18, marginRight: 8, verticalAlign: "-3px" }}>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
);

const TIMES = [
    { value: 0, label: "El tiempo que sea" },
    { value: 100, label: "Menos de 1 h 40" },
    { value: 120, label: "Menos de 2 h" },
    { value: 150, label: "Menos de 2 h 30" },
];

const SOURCES = [
    { id: "watchlist", label: "Mis pendientes" },
    { id: "liked", label: "Las que me gustaron" },
    { id: "friends", label: "Lo que les gustó a mis amigos" },
    { id: "skipped", label: "Las que descarté" },
    { id: "fresh", label: "Nuevas (del catálogo)" },
];

/** "¿Qué vemos hoy?": eliges de dónde sacarla, filtras y la app propone una. */
export default function Tonight({ lists, providers, onClose, onOpen, onFresh, friendPicks = [] }) {
    const [maxMinutes, setMaxMinutes] = useState(0);
    const [providerId, setProviderId] = useState(0);
    const [sources, setSources] = useState({ watchlist: true, liked: true, friends: true, skipped: false, fresh: true });
    const [pick, setPick] = useState(null);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);

    const toggle = (id) => setSources((current) => ({ ...current, [id]: !current[id] }));

    /** Cuántos títulos hay en cada fuente; las novedades del catálogo no se pueden contar. */
    const countOf = (id) => {
        if (id === "fresh") return null;
        if (id === "friends") return friendPicks.length;
        return lists[id]?.length ?? 0;
    };

    async function roll() {
        setLoading(true);
        setSearched(true);

        const pool = [
            ...(sources.watchlist ? lists.watchlist : []),
            ...(sources.liked ? lists.liked : []),
            ...(sources.friends ? friendPicks : []),
            ...(sources.skipped ? lists.skipped : []),
            ...(sources.fresh ? await onFresh() : []),
        ];

        setPick(tonightPick(pool, { maxMinutes: maxMinutes || null, providerId: providerId || null }));
        setLoading(false);
    }

    const count = [
        sources.watchlist && lists.watchlist.length,
        sources.liked && lists.liked.length,
        sources.friends && friendPicks.length,
        sources.skipped && lists.skipped.length,
    ].reduce((sum, value) => sum + (value || 0), 0);

    return (
        <div className="sheet" onClick={onClose}>
            <div className="sheet-card" onClick={(event) => event.stopPropagation()}>
                <h2>¿Qué vemos hoy?</h2>
                <p className="sheet-meta">
                    {count} títulos tuyos{sources.fresh ? " más novedades del catálogo" : ""}.
                </p>

                <h3 className="section-title">De dónde la saco</h3>
                <div className="checks">
                    {SOURCES.map((source) => (
                        <label key={source.id} className={`check ${sources[source.id] ? "is-on" : ""}`}>
                            <input type="checkbox" checked={sources[source.id]} onChange={() => toggle(source.id)} />
                            {source.label}
                            {countOf(source.id) !== null && <small> · {countOf(source.id)}</small>}
                        </label>
                    ))}
                </div>

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

                {pick && (
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
                                <p className="sheet-meta">{sourceLabel(pick)}</p>
                                <button type="button" className="card-link" style={{ color: "var(--accent)" }} onClick={() => onOpen(pick)}>
                                    Ver ficha
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {searched && !pick && !loading && (
                    <p className="notice">Nada cumple con esos filtros. Prueba con más tiempo, otra plataforma o incluye más listas.</p>
                )}

                <div className="sheet-actions">
                    <button type="button" className="btn btn-primary btn-wide" onClick={roll} disabled={loading}>
                        {loading ? (
                            "Buscando…"
                        ) : (
                            <>
                                <Dice />
                                {pick ? "Proponme otra" : "Elegir por mí"}
                            </>
                        )}
                    </button>
                    <button type="button" className="btn btn-ghost btn-wide" onClick={onClose}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

function sourceLabel(item) {
    if (item.friendNote) return item.friendNote;
    if (!item.decision) return "Del catálogo, no está en tus listas";
    return {
        watchlist: "De tus pendientes",
        liked: `Ya la viste${item.stars ? ` y le diste ${item.stars}★` : ""}`,
        skipped: "La habías descartado",
        disliked: "No te gustó",
    }[item.decision];
}
