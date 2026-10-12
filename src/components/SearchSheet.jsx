import { useEffect, useState } from "react";
import Poster from "./Poster";
import { search } from "../lib/tmdb";

/** Buscador a pantalla completa, para calificar un título específico. */
export default function SearchSheet({ library, onOpen, onClose }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (query.trim().length < 3) {
            setResults([]);
            return;
        }
        setLoading(true);
        const timer = setTimeout(async () => {
            const [movies, shows] = await Promise.all([search(query, "movie"), search(query, "tv")]);
            setResults([...movies, ...shows].sort((a, b) => b.popularity - a.popularity).slice(0, 18));
            setLoading(false);
        }, 350);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="search-screen">
            <div className="search-bar">
                <input
                    autoFocus
                    type="search"
                    value={query}
                    placeholder="Busca una peli o serie…"
                    onChange={(event) => setQuery(event.target.value)}
                />
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                    Cerrar
                </button>
            </div>

            <div className="search-body">
                {loading && <p className="empty">Buscando…</p>}
                {!loading && query.trim().length >= 3 && results.length === 0 && (
                    <p className="empty">Nada con ese nombre.</p>
                )}
                {!loading && query.trim().length < 3 && (
                    <div className="empty">
                        <b>Busca lo que quieras calificar</b>
                        <p>Útil para esa película que ya viste y no quieres esperar a que salga en la baraja.</p>
                    </div>
                )}
                {results.length > 0 && (
                    <div className="grid-cards">
                        {results.map((item) => (
                            <Poster
                                key={item.id}
                                item={{ ...item, stars: library[item.id]?.stars }}
                                onClick={() => onOpen(item)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
