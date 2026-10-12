import { describe, expect, it } from "vitest";
import { buildTaste, filterDeck, genreScores, libraryStats, rankDeck, tonightPick, translateGenres } from "./taste";

const SCIFI = 878;
const COMEDY = 35;
const HORROR = 27;

const entry = (decision, genreIds, extra = {}) => ({ decision, genreIds, ...extra });

describe("perfil de gustos", () => {
    it("sube los géneros que te gustan y baja los que descartas", () => {
        const scores = genreScores([
            entry("liked", [SCIFI]),
            entry("liked", [SCIFI]),
            entry("disliked", [HORROR]),
        ]);
        expect(scores[0].id).toBe(SCIFI);
        expect(scores.at(-1).id).toBe(HORROR);
        expect(scores.at(-1).score).toBeLessThan(0);
    });

    it("las 5 estrellas pesan más que las 3", () => {
        const tres = genreScores([entry("liked", [SCIFI], { stars: 3 })])[0].score;
        const cinco = genreScores([entry("liked", [SCIFI], { stars: 5 })])[0].score;
        expect(cinco).toBeGreaterThan(0);
        expect(tres).toBeGreaterThan(0);
        // normalizados ambos dan 1, así que se compara la suma con otro género de por medio
        const mezcla = genreScores([
            entry("liked", [SCIFI], { stars: 5 }),
            entry("liked", [COMEDY], { stars: 3 }),
        ]);
        expect(mezcla[0].id).toBe(SCIFI);
    });

    it("no filtra nada hasta tener suficientes calificaciones", () => {
        const taste = buildTaste([entry("liked", [SCIFI]), entry("liked", [SCIFI])]);
        expect(taste.ready).toBe(false);
        expect(taste.genres).toEqual([]);
    });

    it("con suficientes datos propone géneros y descarta los que no te laten", () => {
        const taste = buildTaste([
            entry("liked", [SCIFI], { stars: 5 }),
            entry("liked", [SCIFI], { stars: 4 }),
            entry("liked", [SCIFI, COMEDY], { stars: 5 }),
            entry("disliked", [HORROR]),
            entry("disliked", [HORROR]),
            entry("skipped", [HORROR]),
        ]);
        expect(taste.ready).toBe(true);
        expect(taste.genres).toContain(SCIFI);
        expect(taste.avoidGenres).toContain(HORROR);
    });

    it("un género que te gusta nunca termina en la lista de evitar", () => {
        const taste = buildTaste([
            entry("liked", [SCIFI], { stars: 5 }),
            entry("liked", [SCIFI], { stars: 5 }),
            entry("liked", [SCIFI], { stars: 5 }),
            entry("disliked", [SCIFI]),
            entry("skipped", [SCIFI]),
        ]);
        expect(taste.avoidGenres).not.toContain(SCIFI);
    });

    it("saca tu década favorita solo con suficientes películas", () => {
        const pocos = buildTaste([entry("liked", [SCIFI], { year: 1995 })]);
        expect(pocos.decade).toBeNull();

        const taste = buildTaste([
            entry("liked", [SCIFI], { year: 1994 }),
            entry("liked", [SCIFI], { year: 1996 }),
            entry("liked", [SCIFI], { year: 1999 }),
            entry("liked", [COMEDY], { year: 1997 }),
            entry("liked", [COMEDY], { year: 1995 }),
        ]);
        expect(taste.decade).toBe(1990);
    });
});

describe("baraja", () => {
    const deck = [
        { id: "movie:1", genreIds: [SCIFI], rating: 8 },
        { id: "movie:2", genreIds: [COMEDY], rating: 7 },
        { id: "movie:3", genreIds: [HORROR], rating: 6 },
    ];

    it("saca lo que ya decidiste y lo que ya viste pasar", () => {
        const library = { "movie:1": { decision: "liked" } };
        const result = filterDeck(deck, library, new Set(["movie:2"]));
        expect(result.map((item) => item.id)).toEqual(["movie:3"]);
    });

    it("pone primero lo que embona con tus gustos", () => {
        const taste = { ready: true, topGenres: [{ id: SCIFI, score: 1 }] };
        expect(rankDeck(deck, taste)[0].id).toBe("movie:1");
    });

    it("sin perfil, respeta el orden que venga", () => {
        expect(rankDeck(deck, { ready: false })).toEqual(deck);
    });

    it("no pierde ni duplica títulos al intercalar sorpresas", () => {
        const largo = Array.from({ length: 20 }, (_, i) => ({ id: `movie:${i}`, genreIds: [SCIFI], rating: 5 }));
        const result = rankDeck(largo, { ready: true, topGenres: [{ id: SCIFI, score: 1 }] });
        expect(result).toHaveLength(20);
        expect(new Set(result.map((item) => item.id)).size).toBe(20);
    });
});

describe("qué vemos hoy", () => {
    const watchlist = [
        { id: "a", runtime: 95, rating: 8, providerIds: [8] },
        { id: "b", runtime: 180, rating: 9, providerIds: [8] },
        { id: "c", runtime: 100, rating: 7, providerIds: [337] },
    ];

    it("respeta el tiempo que tienes", () => {
        const pick = tonightPick(watchlist, { maxMinutes: 120, random: () => 0 });
        expect(pick.runtime).toBeLessThanOrEqual(120);
    });

    it("respeta la plataforma elegida", () => {
        const pick = tonightPick(watchlist, { providerId: 337, random: () => 0 });
        expect(pick.id).toBe("c");
    });

    it("regresa null si nada cumple", () => {
        expect(tonightPick(watchlist, { maxMinutes: 30 })).toBeNull();
        expect(tonightPick([], {})).toBeNull();
    });
});

describe("resumen", () => {
    it("cuenta cada lista y saca el promedio de estrellas", () => {
        const stats = libraryStats(
            {
                a: { decision: "liked", stars: 5, genreIds: [SCIFI], runtime: 120, type: "movie" },
                b: { decision: "liked", stars: 3, genreIds: [SCIFI], runtime: 120, type: "movie" },
                c: { decision: "watchlist", genreIds: [COMEDY] },
                d: { decision: "disliked", genreIds: [HORROR], runtime: 120, type: "movie" },
            },
            { [SCIFI]: "Ciencia ficción" },
        );
        expect(stats.total).toBe(4);
        expect(stats.liked).toBe(2);
        expect(stats.watchlist).toBe(1);
        expect(stats.averageStars).toBe(4);
        expect(stats.hours).toBe(6); // 3 títulos vistos de 120 min
        expect(stats.topGenres[0].name).toBe("Ciencia ficción");
    });
});

// TMDB usa géneros distintos en cine y en televisión. Pedirle series con géneros de
// película devuelve CERO resultados, así que esto evita que la baraja se quede vacía.
const ACTION_TV = 10759;
const SCIFI_TV = 10765;

describe("géneros de cine contra géneros de series", () => {
    it("acción y aventura de cine se vuelven Action & Adventure en series", () => {
        expect(translateGenres([28, 12], "tv")).toEqual([ACTION_TV]);
    });

    it("ciencia ficción y fantasía se vuelven Sci-Fi & Fantasy", () => {
        expect(translateGenres([878, 14], "tv")).toEqual([SCIFI_TV]);
    });

    it("los que existen igual en los dos lados se quedan como están", () => {
        expect(translateGenres([COMEDY, 18, 16], "tv").sort()).toEqual([16, 18, COMEDY].sort());
    });

    it("terror y suspenso no existen en series: se descartan en vez de vaciar la baraja", () => {
        expect(translateGenres([HORROR, 53], "tv")).toEqual([]);
    });

    it("y de regreso: Action & Adventure se abre en acción y aventura", () => {
        expect(translateGenres([ACTION_TV], "movie").sort()).toEqual([12, 28]);
    });

    it("los de telenovela o noticias no se cuelan al cine", () => {
        expect(translateGenres([10764, 10766], "movie")).toEqual([]);
    });

    it("el perfil para series nunca pide géneros que solo existen en cine", () => {
        const pelis = Array.from({ length: 8 }, () => entry("liked", [SCIFI, 28], { type: "movie", stars: 5 }));
        const taste = buildTaste(pelis, { forType: "tv" });
        expect(taste.ready).toBe(true);
        expect(taste.genres.length).toBeGreaterThan(0);
        expect(taste.genres).not.toContain(SCIFI);
        expect(taste.genres).not.toContain(28);
        expect(taste.genres).toContain(SCIFI_TV);
    });

    it("y el de películas tampoco pide géneros de televisión", () => {
        const series = Array.from({ length: 8 }, () => entry("liked", [ACTION_TV], { type: "tv", stars: 5 }));
        const taste = buildTaste(series, { forType: "movie" });
        expect(taste.genres).not.toContain(ACTION_TV);
        expect(taste.genres).toContain(28);
    });

    it("lo que calificaste del mismo tipo pesa más", () => {
        const mezcla = [
            ...Array.from({ length: 4 }, () => entry("liked", [COMEDY], { type: "movie" })),
            ...Array.from({ length: 4 }, () => entry("liked", [16], { type: "tv" })),
        ];
        expect(buildTaste(mezcla, { forType: "tv" }).topGenres[0].id).toBe(16);
        expect(buildTaste(mezcla, { forType: "movie" }).topGenres[0].id).toBe(COMEDY);
    });
});
