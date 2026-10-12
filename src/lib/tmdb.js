/**
 * Cliente de TMDB (themoviedb.org). Solo lectura, en español y con datos de México.
 *
 * La llave se pone en .env como VITE_TMDB_KEY. Si no hay llave, la app entra en
 * "modo demo" con un puñado de títulos de ejemplo, para poder verla sin configurar nada.
 */
import { DEMO_MOVIES, DEMO_TV } from "./demoData";

const KEY = import.meta.env.VITE_TMDB_KEY;
const BASE = "https://api.themoviedb.org/3";
const LANG = "es-MX";
const REGION = "MX";

export const hasApiKey = Boolean(KEY);
export const IMG = (path, size = "w500") =>
    path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

async function call(path, params = {}) {
    const url = new URL(BASE + path);
    url.search = new URLSearchParams({ api_key: KEY, language: LANG, region: REGION, ...params });

    const response = await fetch(url);
    if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.status_message ?? `TMDB respondió ${response.status}`);
    }
    return response.json();
}

/** Deja películas y series con la misma forma, para tratarlas igual en toda la app. */
export function normalize(item, kind) {
    const type = kind ?? (item.title ? "movie" : "tv");
    const date = item.release_date || item.first_air_date || "";
    return {
        id: `${type}:${item.id}`,
        tmdbId: item.id,
        type,
        title: item.title || item.name,
        originalTitle: item.original_title || item.original_name,
        year: date ? Number(date.slice(0, 4)) : null,
        overview: item.overview,
        poster: IMG(item.poster_path),
        posterHd: IMG(item.poster_path, "w780"),
        backdrop: IMG(item.backdrop_path, "w780"),
        rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
        votes: item.vote_count ?? 0,
        genreIds: item.genre_ids ?? item.genres?.map((genre) => genre.id) ?? [],
        popularity: item.popularity ?? 0,
    };
}

export async function getGenres(type = "movie") {
    if (!hasApiKey) return DEMO_GENRES;
    const data = await call(`/genre/${type}/list`);
    return data.genres;
}

/**
 * Baraja de títulos para la pantalla de explorar.
 * `taste` viene de lib/taste.js y decide géneros, años y orden.
 */
export async function discover({ type = "movie", page = 1, taste = {}, filters = {} } = {}) {
    if (!hasApiKey) return (type === "movie" ? DEMO_MOVIES : DEMO_TV).map((item) => normalize(item, type));

    const params = {
        page: String(page),
        include_adult: "false",
        "vote_count.gte": String(filters.minVotes ?? 120),
        sort_by: filters.sortBy ?? "popularity.desc",
    };

    if (taste.genres?.length) params.with_genres = taste.genres.join("|");
    if (taste.avoidGenres?.length) params.without_genres = taste.avoidGenres.join(",");
    if (filters.providers?.length) {
        params.with_watch_providers = filters.providers.join("|");
        params.watch_region = REGION;
    }
    if (filters.fromYear) {
        params[type === "movie" ? "primary_release_date.gte" : "first_air_date.gte"] = `${filters.fromYear}-01-01`;
    }
    if (filters.maxRuntime && type === "movie") params["with_runtime.lte"] = String(filters.maxRuntime);

    const data = await call(`/discover/${type}`, params);
    return data.results.map((item) => normalize(item, type));
}

export async function search(query, type = "movie") {
    if (!hasApiKey || !query.trim()) return [];
    const data = await call(`/search/${type}`, { query, include_adult: "false" });
    return data.results.map((item) => normalize(item, type));
}

/** Ficha completa: duración, reparto, dónde verla y títulos parecidos. */
export async function getDetails(type, tmdbId) {
    if (!hasApiKey) {
        const demo = [...DEMO_MOVIES, ...DEMO_TV].find((item) => item.id === Number(tmdbId));
        return demo ? { ...normalize(demo, type), providers: [], cast: [], director: null, runtime: demo.runtime } : null;
    }

    const data = await call(`/${type}/${tmdbId}`, {
        append_to_response: "credits,watch/providers,recommendations",
    });

    const providers = data["watch/providers"]?.results?.[REGION] ?? {};
    const crew = data.credits?.crew ?? [];

    return {
        ...normalize(data, type),
        runtime: data.runtime ?? data.episode_run_time?.[0] ?? null,
        seasons: data.number_of_seasons ?? null,
        tagline: data.tagline || null,
        genres: data.genres ?? [],
        cast: (data.credits?.cast ?? []).slice(0, 6).map((person) => ({
            id: person.id,
            name: person.name,
            character: person.character,
            photo: IMG(person.profile_path, "w185"),
        })),
        director:
            crew.find((person) => person.job === "Director")?.name ??
            (data.created_by?.[0]?.name || null),
        directorId: crew.find((person) => person.job === "Director")?.id ?? null,
        // flatrate = incluido en la suscripción; rent/buy = se paga aparte
        providers: ["flatrate", "rent", "buy"].flatMap((mode) =>
            (providers[mode] ?? []).map((provider) => ({
                id: provider.provider_id,
                name: provider.provider_name,
                logo: IMG(provider.logo_path, "w92"),
                mode,
            })),
        ),
        link: providers.link ?? null,
        similar: (data.recommendations?.results ?? []).slice(0, 12).map((item) => normalize(item, type)),
    };
}

/** Plataformas disponibles en México, para el filtro de "dónde verla". */
export async function getProviders(type = "movie") {
    if (!hasApiKey) return DEMO_PROVIDERS;
    const data = await call(`/watch/providers/${type}`, { watch_region: REGION });
    return data.results
        .filter((provider) => provider.display_priority < 30)
        .sort((a, b) => a.display_priority - b.display_priority)
        .map((provider) => ({
            id: provider.provider_id,
            name: provider.provider_name,
            logo: IMG(provider.logo_path, "w92"),
        }));
}

export const DEMO_GENRES = [
    { id: 28, name: "Acción" },
    { id: 12, name: "Aventura" },
    { id: 35, name: "Comedia" },
    { id: 18, name: "Drama" },
    { id: 80, name: "Crimen" },
    { id: 878, name: "Ciencia ficción" },
    { id: 27, name: "Terror" },
    { id: 53, name: "Suspenso" },
    { id: 16, name: "Animación" },
    { id: 9648, name: "Misterio" },
    { id: 10749, name: "Romance" },
    { id: 10751, name: "Familia" },
    { id: 10765, name: "Sci-Fi y fantasía" },
];

export const DEMO_PROVIDERS = [
    { id: 8, name: "Netflix", logo: null },
    { id: 119, name: "Prime Video", logo: null },
    { id: 337, name: "Disney+", logo: null },
    { id: 1899, name: "Max", logo: null },
];
