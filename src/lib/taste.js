/**
 * Perfil de gustos: a partir de lo que calificas, saca qué géneros y épocas te laten
 * y cuáles evitas. Con eso se arma la baraja de "Explorar".
 *
 * Es una función pura (entra tu biblioteca, sale un perfil), así que se prueba sola.
 */

export const DECISIONS = {
    liked: "liked", // la vi y me gustó
    disliked: "disliked", // la vi y no me gustó
    watchlist: "watchlist", // pendiente por ver
    skipped: "skipped", // no me interesa
};

// Cuánto pesa cada decisión al calcular tus gustos
const WEIGHTS = {
    liked: 1,
    watchlist: 0.4,
    skipped: -0.5,
    disliked: -1,
};

/**
 * TMDB no usa los mismos géneros en cine que en televisión: "Acción" (28) no existe
 * en series, donde es "Action & Adventure" (10759). Si se le piden series con géneros
 * de película, devuelve CERO resultados, así que hay que traducir.
 */
const TO_TV = { 28: 10759, 12: 10759, 878: 10765, 14: 10765, 10752: 10768, 36: 10768 };
const TO_MOVIE = { 10759: [28, 12], 10765: [878, 14], 10768: [10752, 36] };
// Los que solo existen de un lado y no tienen equivalente (terror, suspenso, romance…)
const ONLY_MOVIE = new Set([27, 53, 10749, 10402]);
const ONLY_TV = new Set([10762, 10763, 10764, 10766, 10767]);

/** Pasa una lista de géneros al vocabulario de películas o al de series. */
export function translateGenres(ids = [], forType) {
    const out = new Set();
    for (const id of ids) {
        if (forType === "tv") {
            if (ONLY_MOVIE.has(id)) continue;
            if (ONLY_TV.has(id) || TO_MOVIE[id]) out.add(id);
            else out.add(TO_TV[id] ?? id);
        } else {
            if (ONLY_TV.has(id)) continue;
            if (TO_MOVIE[id]) TO_MOVIE[id].forEach((movieId) => out.add(movieId));
            else if (ONLY_MOVIE.has(id) || !TO_TV[id]) out.add(id);
            else out.add(id);
        }
    }
    return [...out];
}

/** Lo que calificaste del mismo tipo pesa más que lo del otro, pero todo cuenta. */
const SAME_TYPE_BOOST = 1.6;

const adaptEntry = (entry, forType) => ({
    ...entry,
    genreIds: translateGenres(entry.genreIds ?? [], forType),
    boost: entry.type === forType ? SAME_TYPE_BOOST : 1,
});

/** Una calificación de 1 a 5 estrellas ajusta el peso: 5★ cuenta el doble que 3★. */
function entryWeight(entry) {
    const base = (WEIGHTS[entry.decision] ?? 0) * (entry.boost ?? 1);
    if (entry.decision !== "liked" || !entry.stars) return base;
    return base * (entry.stars / 3);
}

/**
 * Suma los pesos por género y los normaliza de -1 a 1.
 * `entries` es la lista de títulos que ya decidiste, con sus géneros.
 */
export function genreScores(entries) {
    const scores = new Map();
    for (const entry of entries) {
        const weight = entryWeight(entry);
        if (!weight) continue;
        for (const genreId of entry.genreIds ?? []) {
            scores.set(genreId, (scores.get(genreId) ?? 0) + weight);
        }
    }

    const max = Math.max(1, ...[...scores.values()].map(Math.abs));
    return [...scores.entries()]
        .map(([id, score]) => ({ id: Number(id), score: score / max }))
        .sort((a, b) => b.score - a.score);
}

/** Década promedio de lo que te gusta, para no recomendarte puro estreno si eres de clásicos. */
export function favoriteDecade(entries) {
    const years = entries
        .filter((entry) => entry.decision === "liked" && entry.year)
        .map((entry) => entry.year);
    if (years.length < 3) return null;
    const average = years.reduce((sum, year) => sum + year, 0) / years.length;
    return Math.floor(average / 10) * 10;
}

/**
 * Perfil listo para pedirle títulos a TMDB.
 * Mientras no haya suficientes calificaciones, no filtra nada: primero hay que
 * conocer a la persona (arranque en frío).
 */
export function buildTaste(entries, { minEntries = 5, topGenres = 4, forType = null } = {}) {
    const rated = entries.filter((entry) => entry.decision);
    if (rated.length < minEntries) {
        return { ready: false, rated: rated.length, genres: [], avoidGenres: [], decade: null, topGenres: [] };
    }

    // Con `forType` el perfil se traduce al vocabulario de ese tipo: si no, pedirle
    // series a TMDB con géneros de cine no devuelve nada.
    const scores = genreScores(forType ? rated.map((entry) => adaptEntry(entry, forType)) : rated);
    const liked = scores.filter((genre) => genre.score > 0.25).slice(0, topGenres);
    const avoided = scores.filter((genre) => genre.score < -0.5).map((genre) => genre.id);

    return {
        ready: true,
        rated: rated.length,
        genres: liked.map((genre) => genre.id),
        topGenres: liked,
        // Nunca se descarta un género que también te gusta
        avoidGenres: avoided.filter((id) => !liked.some((genre) => genre.id === id)),
        decade: favoriteDecade(rated),
    };
}

/** Quita de la baraja lo que ya decidiste y lo que ya viste pasar. */
export function filterDeck(items, library, seenIds = new Set()) {
    return items.filter((item) => !library[item.id] && !seenIds.has(item.id));
}

/**
 * Ordena la baraja: primero lo que más embona con tus gustos, pero dejando entrar
 * algo distinto de vez en cuando para no encerrarte en lo mismo de siempre.
 */
export function rankDeck(items, taste, { surpriseEvery = 5 } = {}) {
    if (!taste.ready) return items;

    const weights = new Map(taste.topGenres.map((genre) => [genre.id, genre.score]));
    const scored = items.map((item) => {
        const match = (item.genreIds ?? []).reduce((sum, id) => sum + (weights.get(id) ?? 0), 0);
        const quality = (item.rating ?? 6) / 10;
        return { item, score: match * 2 + quality };
    });

    scored.sort((a, b) => b.score - a.score);
    const ordered = scored.map((entry) => entry.item);

    // Cada ciertas tarjetas se intercala una del final: la "sorpresa"
    const result = [];
    const tail = ordered.splice(Math.ceil(ordered.length * 0.6));
    while (ordered.length) {
        result.push(ordered.shift());
        if (result.length % surpriseEvery === 0 && tail.length) result.push(tail.shift());
    }
    return [...result, ...tail];
}

/**
 * "¿Qué vemos hoy?": de tus pendientes, filtra por tiempo y plataforma y
 * regresa una sugerencia (con un poco de azar para que no salga siempre la misma).
 */
export function tonightPick(watchlist, { maxMinutes, providerId, random = Math.random } = {}) {
    const candidates = watchlist.filter((item) => {
        if (maxMinutes && item.runtime && item.runtime > maxMinutes) return false;
        if (providerId && !(item.providerIds ?? []).includes(providerId)) return false;
        return true;
    });
    if (!candidates.length) return null;

    // Entre las mejor calificadas, una al azar
    const pool = [...candidates].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, Math.max(3, Math.ceil(candidates.length * 0.4)));
    return pool[Math.floor(random() * pool.length)];
}

/** Resumen para la pantalla de perfil: cuántas viste, tu nota promedio y tus géneros. */
export function libraryStats(entries, genreNames = {}) {
    const list = Object.values(entries);
    const liked = list.filter((entry) => entry.decision === "liked");
    const stars = liked.filter((entry) => entry.stars).map((entry) => entry.stars);

    return {
        total: list.length,
        liked: liked.length,
        disliked: list.filter((entry) => entry.decision === "disliked").length,
        watchlist: list.filter((entry) => entry.decision === "watchlist").length,
        skipped: list.filter((entry) => entry.decision === "skipped").length,
        hours: Math.round(list.filter((e) => e.decision === "liked" || e.decision === "disliked")
            .reduce((sum, entry) => sum + (entry.runtime ?? (entry.type === "tv" ? 300 : 110)), 0) / 60),
        averageStars: stars.length ? Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10 : null,
        topGenres: genreScores(list)
            .filter((genre) => genre.score > 0)
            .slice(0, 5)
            .map((genre) => ({ ...genre, name: genreNames[genre.id] ?? `Género ${genre.id}` })),
    };
}
