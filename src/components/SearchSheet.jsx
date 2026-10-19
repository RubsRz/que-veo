import { useEffect, useMemo, useState } from "react";
import Poster from "./Poster";
import { search } from "../lib/tmdb";
import { useLayer } from "../lib/layers";
import { matchesQuery } from "../lib/text";

const KINDS = [
    { id: "all", label: "Todo" },
    { id: "movie", label: "Películas" },
    { id: "tv", label: "Series" },
];

/** Lo que dice el póster sobre lo que ya hiciste con ese título. */
const STATUS = {
    watchlist: "Pendiente",
    skipped: "No la has visto",
    liked: "Ya la viste",
    disliked: "Ya la viste",
};

const MIN = 2; // letras para empezar a buscar en el catálogo

/**
 * El buscador general. Primero enseña lo que ya está en tus listas (al instante,
 * sin red), luego el catálogo. Cada póster dice si es película o serie y qué
 * hiciste con él, para no abrir la ficha solo para saberlo.
 */
export default function SearchSheet({ library, initialQuery = "", onOpen, onClose }) {
    const [query, setQuery] = useState(initialQuery);
    const [kind, setKind] = useState("all");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    useLayer(onClose);

    const text = query.trim();
    const ready = text.length >= MIN;
    const ofKind = (item) => kind === "all" || item.type === kind;

    // Lo tuyo sale primero y sin esperar al catálogo
    const mine = useMemo(() => {
        if (!ready) return [];
        return Object.values(library)
            .filter((entry) => ofKind(entry) && matchesQuery(entry, text))
            .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
            .slice(0, 12);
    }, [library, text, ready, kind]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!ready) {
            setResults([]);
            setLoading(false);
            return;
        }
        let alive = true; // si escribes más rápido que la red, gana la última búsqueda
        setLoading(true);
        setFailed(false);
        const timer = setTimeout(async () => {
            try {
                const [movies, shows] = await Promise.all([search(text, "movie"), search(text, "tv")]);
                if (alive) setResults([...movies, ...shows].sort((a, b) => b.popularity - a.popularity).slice(0, 24));
            } catch {
                if (alive) setFailed(true);
            } finally {
                if (alive) setLoading(false);
            }
        }, 300);
        return () => {
            alive = false;
            clearTimeout(timer);
        };
    }, [text, ready]);

    const mineIds = new Set(mine.map((item) => item.id));
    const catalog = results.filter((item) => ofKind(item) && !mineIds.has(item.id));

    const tile = (item) => {
        const entry = library[item.id];
        const type = item.type === "tv" ? "Serie" : "Película";
        return (
            <Poster
                key={item.id}
                item={{ ...item, stars: entry?.stars }}
                // Las estrellas ya salen en el póster; lo demás va en la nota
                note={entry && !entry.stars ? `${type} · ${STATUS[entry.decision]}` : type}
                onClick={() => onOpen(entry ? { ...item, ...entry } : item)}
            />
        );
    };

    return (
        <div className="search-screen" role="dialog" aria-modal="true" aria-label="Buscar">
            <div className="search-bar">
                <div className="search-field">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="6.5" />
                        <path d="M16 16l4.5 4.5" />
                    </svg>
                    <input
                        autoFocus
                        type="search"
                        value={query}
                        placeholder="Película o serie…"
                        aria-label="Buscar película o serie"
                        enterKeyHint="search"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    {query && (
                        <button type="button" className="list-search-clear" onClick={() => setQuery("")} aria-label="Borrar búsqueda">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                                <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>
                    )}
                </div>
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                    Cerrar
                </button>
            </div>

            <div className="search-kinds segmented" role="group" aria-label="Qué buscar">
                {KINDS.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        className={kind === option.id ? "is-active" : ""}
                        aria-pressed={kind === option.id}
                        onClick={() => setKind(option.id)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <div className="search-body">
                {!ready && (
                    <div className="empty">
                        <b>¿Qué quieres encontrar?</b>
                        <p>
                            Escribe el nombre de una película o serie. Primero te enseño las que ya están en tus listas y luego
                            todo el catálogo, con dónde verla.
                        </p>
                    </div>
                )}

                {mine.length > 0 && (
                    <>
                        <h3 className="section-title">
                            En tus listas <small className="count">{mine.length}</small>
                        </h3>
                        <div className="grid-cards">{mine.map(tile)}</div>
                    </>
                )}

                {ready && (
                    <>
                        <h3 className="section-title">
                            En el catálogo {!loading && !failed && <small className="count">{catalog.length}</small>}
                        </h3>
                        {loading && catalog.length === 0 && <p className="sheet-meta">Buscando…</p>}
                        {failed && <p className="notice">No se pudo buscar. Revisa tu conexión e intenta otra vez.</p>}
                        {!loading && !failed && catalog.length === 0 && (
                            <p className="sheet-meta">
                                {mine.length ? "Nada más con ese nombre." : `Nada con “${text}”. Prueba con menos letras o con el nombre original.`}
                            </p>
                        )}
                        {catalog.length > 0 && <div className="grid-cards">{catalog.map(tile)}</div>}
                    </>
                )}
            </div>
        </div>
    );
}
