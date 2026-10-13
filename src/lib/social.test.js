import { describe, expect, it } from "vitest";
import {
    affinity,
    friendsBadge,
    friendshipId,
    makeCode,
    normalizeCode,
    ratingsByItem,
    sortSharedItems,
    trendingAmongFriends,
    watchTogether,
} from "./social";

const title = (id, decision, extra = {}) => ({ id, title: id, decision, ...extra });
const library = (...entries) => Object.fromEntries(entries.map((entry) => [entry.id, entry]));

const ANA = { uid: "ana", name: "Ana", photo: null };
const LUIS = { uid: "luis", name: "Luis", photo: null };

describe("identidad de la amistad", () => {
    it("da el mismo id sin importar quién invitó", () => {
        expect(friendshipId("ana", "luis")).toBe(friendshipId("luis", "ana"));
    });

    it("los códigos no traen letras que se confundan", () => {
        const code = makeCode(() => 0.999);
        expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
        expect(makeCode()).not.toMatch(/[O0I1]/);
    });

    it("acomoda el código aunque lo escribas de corrido o en minúsculas", () => {
        expect(normalizeCode("abc2k9")).toBe("ABC-2K9");
        expect(normalizeCode("ABC-2K9")).toBe("ABC-2K9");
        expect(normalizeCode("ab")).toBe("AB");
    });
});

describe("quién opinó de cada título", () => {
    const libraries = {
        ana: library(title("movie:1", "liked", { stars: 5 }), title("movie:2", "watchlist")),
        luis: library(title("movie:1", "liked", { stars: 3 }), title("movie:3", "skipped")),
    };

    it("junta las opiniones de cada amigo por título", () => {
        const ratings = ratingsByItem(libraries, [ANA, LUIS]);
        expect(ratings["movie:1"].map((opinion) => opinion.name)).toEqual(["Ana", "Luis"]);
        expect(ratings["movie:2"][0].decision).toBe("watchlist");
    });

    it("lo que alguien descartó no se le cuenta a nadie", () => {
        expect(ratingsByItem(libraries, [ANA, LUIS])["movie:3"]).toBeUndefined();
    });

    it("ignora a quien ya no es tu amigo", () => {
        expect(ratingsByItem(libraries, [ANA])["movie:1"]).toHaveLength(1);
    });

    it("arma el aviso de la tarjeta", () => {
        const ratings = ratingsByItem(libraries, [ANA, LUIS]);
        expect(friendsBadge(ratings["movie:1"])).toMatchObject({ text: "A Ana y 1 más les gustó", kind: "liked" });
        expect(friendsBadge(ratings["movie:2"])).toMatchObject({ text: "A Ana la tiene pendiente" });
        expect(friendsBadge([])).toBeNull();
    });

    it("si solo una persona la calificó, el aviso trae sus estrellas", () => {
        const solo = ratingsByItem({ ana: libraries.ana }, [ANA]);
        expect(friendsBadge(solo["movie:1"]).stars).toBe(5);
    });
});

describe("afinidad", () => {
    it("no se aventura con menos de tres títulos en común", () => {
        const mine = library(title("movie:1", "liked"));
        expect(affinity(mine, mine).score).toBeNull();
    });

    it("dos gustos iguales dan 100", () => {
        const mine = library(title("a", "liked"), title("b", "liked"), title("c", "disliked"));
        expect(affinity(mine, mine).score).toBe(100);
    });

    it("baja cuando uno la amó y el otro la odió", () => {
        const mine = library(title("a", "liked"), title("b", "liked"), title("c", "liked"));
        const theirs = library(title("a", "liked"), title("b", "disliked"), title("c", "disliked"));
        expect(affinity(mine, theirs).score).toBe(33);
    });

    it("gustarles a los dos pero con 5★ contra 1★ no cuenta como coincidir", () => {
        const mine = library(title("a", "liked", { stars: 5 }), title("b", "liked"), title("c", "liked"));
        const theirs = library(title("a", "liked", { stars: 1 }), title("b", "liked"), title("c", "liked"));
        expect(affinity(mine, theirs).score).toBe(67);
    });

    it("las pendientes no opinan: no suman ni restan", () => {
        const mine = library(title("a", "watchlist"), title("b", "liked"));
        const theirs = library(title("a", "watchlist"), title("b", "liked"));
        expect(affinity(mine, theirs).shared).toBe(1);
    });
});

describe("qué ver juntos", () => {
    const mine = library(
        title("a", "watchlist"),
        title("b", "liked", { stars: 5 }),
        title("d", "disliked"),
    );
    const theirs = library(
        title("a", "watchlist"),
        title("c", "liked", { stars: 5 }),
        title("d", "liked", { stars: 5 }),
        title("e", "liked", { stars: 2 }),
    );

    it("encuentra lo que los dos tienen pendiente", () => {
        expect(watchTogether(mine, theirs).both.map((item) => item.id)).toEqual(["a"]);
    });

    it("te propone lo que le encantó y tú no has visto", () => {
        const { fromThem } = watchTogether(mine, theirs);
        expect(fromThem.map((item) => item.id)).toEqual(["c"]);
    });

    it("no te propone lo que a ti ya no te gustó", () => {
        expect(watchTogether(mine, theirs).fromThem.map((item) => item.id)).not.toContain("d");
    });

    it("también te dice qué recomendarle", () => {
        expect(watchTogether(mine, theirs).forThem.map((item) => item.id)).toEqual(["b"]);
    });

    it("lo que apenas le latió (2★) no se propone", () => {
        expect(watchTogether(mine, theirs).fromThem.map((item) => item.id)).not.toContain("e");
    });
});

describe("lo que anda viendo tu círculo", () => {
    it("saca lo que le gustó a dos o más y tú no has visto", () => {
        const libraries = {
            ana: library(title("a", "liked", { stars: 5 }), title("b", "liked")),
            luis: library(title("a", "liked", { stars: 4 })),
        };
        const ratings = ratingsByItem(libraries, [ANA, LUIS]);
        const trending = trendingAmongFriends(ratings, library(title("z", "liked")));
        expect(trending).toHaveLength(1);
        expect(trending[0].liked).toBe(2);
        expect(trending[0].stars).toBe(4.5);
    });

    it("no repite lo que tú ya calificaste", () => {
        const libraries = { ana: library(title("a", "liked")), luis: library(title("a", "liked")) };
        const ratings = ratingsByItem(libraries, [ANA, LUIS]);
        expect(trendingAmongFriends(ratings, library(title("a", "disliked")))).toHaveLength(0);
    });
});

describe("listas en conjunto", () => {
    it("las ya vistas se van hasta abajo", () => {
        const items = [
            { id: "a", watched: true, addedAt: "2026-01-03" },
            { id: "b", addedAt: "2026-01-01" },
            { id: "c", addedAt: "2026-01-02" },
        ];
        expect(sortSharedItems(items).map((item) => item.id)).toEqual(["c", "b", "a"]);
    });
});

describe("medias estrellas entre amigos", () => {
    it("4.5 contra 4 sigue siendo coincidir", () => {
        const mine = library(title("a", "liked", { stars: 4.5 }), title("b", "liked"), title("c", "liked"));
        const theirs = library(title("a", "liked", { stars: 4 }), title("b", "liked"), title("c", "liked"));
        expect(affinity(mine, theirs).score).toBe(100);
    });

    it("4.5 contra 1.5 ya no", () => {
        const mine = library(title("a", "liked", { stars: 4.5 }), title("b", "liked"), title("c", "liked"));
        const theirs = library(title("a", "liked", { stars: 1.5 }), title("b", "liked"), title("c", "liked"));
        expect(affinity(mine, theirs).score).toBe(67);
    });

    it("el aviso de la tarjeta trae la media estrella", () => {
        const ratings = ratingsByItem({ ana: library(title("x", "liked", { stars: 4.5 })) }, [ANA]);
        expect(friendsBadge(ratings["x"]).stars).toBe(4.5);
    });
});
