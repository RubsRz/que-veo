import { useCallback, useEffect, useRef, useState } from "react";
import { filterDeck, rankDeck } from "./taste";
import { discover } from "./tmdb";

// Cada tantas calificaciones se cuela una de las que dijiste que no habías visto,
// por si ahora sí te late: la que mejor embone con tus gustos.
const RESURFACE_EVERY = 50;

/**
 * La baraja de Explorar: una por tipo (películas y series), que se va rellenando
 * sola cuando se acaba y nunca muestra lo que ya decidiste.
 */
export function useDeck({ type, taste, library, libraryReady }) {
    const [decks, setDecks] = useState({ movie: [], tv: [] });
    const [pages, setPages] = useState({ movie: 1, tv: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const seen = useRef(new Set());
    // Páginas seguidas que no trajeron nada nuevo: evita pedir sin fin cuando ya viste todo
    const emptyTries = useRef({ movie: 0, tv: 0 });
    const revived = useRef(0); // cuántas veces ya se recuperó una "no la he visto"

    /** Trae más títulos, quita los que ya decidiste y los ordena según tus gustos. */
    const loadMore = useCallback(
        async (kind, reset = false) => {
            setLoading(true);
            setError(null);
            try {
                const page = reset ? 1 : pages[kind];
                if (reset) emptyTries.current[kind] = 0;
                const found = await discover({ type: kind, page, taste });
                const fresh = rankDeck(filterDeck(found, library, seen.current), taste);
                emptyTries.current[kind] = fresh.length ? 0 : emptyTries.current[kind] + 1;

                // Cada cierto número de calificaciones se cuela una de las que dijiste
                // que no habías visto: la que mejor embone con tus gustos, marcada.
                const calificadas = Object.values(library).filter((entry) => entry.stars).length;
                const toca = calificadas > 0 && Math.floor(calificadas / RESURFACE_EVERY) > revived.current;
                if (toca && fresh.length > 3) {
                    const skipped = Object.values(library).filter(
                        (entry) => entry.decision === "skipped" && entry.type === kind && !seen.current.has(entry.id),
                    );
                    const [mejor] = rankDeck(skipped, taste);
                    if (mejor) {
                        revived.current = Math.floor(calificadas / RESURFACE_EVERY);
                        fresh.splice(3, 0, { ...mejor, resurfaced: true });
                    }
                }
                setDecks((current) => ({ ...current, [kind]: reset ? fresh : [...current[kind], ...fresh] }));
                setPages((current) => ({ ...current, [kind]: page + 1 }));
            } catch (requestError) {
                setError(requestError.message);
            } finally {
                setLoading(false);
            }
        },
        [pages, taste, library],
    );

    // Primera carga de cada baraja
    useEffect(() => {
        // Hasta que no lleguen tus listas no se arma la baraja, para no repetir títulos
        if (libraryReady && decks[type].length === 0 && !error) loadMore(type, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, libraryReady]);

    // Red de seguridad: si algo ya decidido se coló en la baraja, se quita
    useEffect(() => {
        setDecks((current) => {
            const clean = {};
            let changed = false;
            for (const [kind, cards] of Object.entries(current)) {
                clean[kind] = cards.filter((card) => card.resurfaced || !library[card.id]);
                if (clean[kind].length !== cards.length) changed = true;
            }
            return changed ? clean : current;
        });
    }, [library]);

    // Cuando se está acabando la baraja (o ya se vació) se piden más páginas
    useEffect(() => {
        if (!loading && !error && decks[type].length < 4 && emptyTries.current[type] < 5) loadMore(type);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [decks, type]);

    /** Ya decidiste esta: fuera de la baraja y que no vuelva a salir. */
    const take = useCallback((item) => {
        seen.current.add(item.id);
        setDecks((current) => ({ ...current, [item.type]: current[item.type].filter((card) => card.id !== item.id) }));
    }, []);

    /** Deshacer: la regresa hasta arriba. */
    const putBack = useCallback((item) => {
        seen.current.delete(item.id);
        setDecks((current) => ({ ...current, [item.type]: [item, ...current[item.type].filter((card) => card.id !== item.id)] }));
    }, []);

    const retry = useCallback(() => loadMore(type, true), [loadMore, type]);

    const searchMore = useCallback(() => {
        emptyTries.current[type] = 0;
        loadMore(type);
    }, [loadMore, type]);

    return { deck: decks[type], loading, error, take, putBack, retry, searchMore };
}
