import { describe, expect, it } from "vitest";
import { accessLabel, groupProviders, platformCatalog, platformKey } from "./platforms";

const p = (name, mode = "flatrate") => ({ id: name, name, logo: null, mode });

describe("plataformas", () => {
    it("reconoce el mismo servicio en sus variantes", () => {
        expect(platformKey("Netflix Standard with Ads")).toBe("netflix");
        expect(platformKey("HBO Max Amazon Channel")).toBe("hbo max");
        expect(platformKey("Amazon Prime Video with Ads")).toBe("amazon prime video");
        expect(platformKey("Max")).toBe("hbo max");
        expect(platformKey("Prime Video")).toBe("amazon prime video");
    });

    it("no junta servicios distintos", () => {
        expect(platformKey("Amazon Video")).not.toBe(platformKey("Amazon Prime Video"));
        expect(platformKey("Universal+ Amazon Channel")).toBe("universal+");
    });

    it("la ficha de Shrek pasa de 11 chips a 7", () => {
        const groups = groupProviders([
            p("Netflix"),
            p("Amazon Prime Video"),
            p("HBO Max"),
            p("HBO Max Amazon Channel"),
            p("Claro video"),
            p("Netflix Standard with Ads"),
            p("Universal+ Amazon Channel"),
            p("Amazon Prime Video with Ads"),
            p("Apple TV Store", "rent"),
            p("Amazon Video", "rent"),
            p("Apple TV Store", "buy"),
            p("Amazon Video", "buy"),
        ]);
        expect(groups.map((group) => group.name)).toEqual([
            "Netflix",
            "Amazon Prime Video",
            "HBO Max",
            "Claro video",
            "Universal+ Amazon Channel",
            "Apple TV Store",
            "Amazon Video",
        ]);
        expect(accessLabel(groups[5])).toBe("renta o compra");
        expect(accessLabel(groups[0])).toBeNull();
    });

    it("las tuyas van primero y se marcan", () => {
        const groups = groupProviders([p("Netflix"), p("Disney Plus"), p("Apple TV Store", "rent")], ["disney+"]);
        expect(groups[0]).toMatchObject({ name: "Disney Plus", mine: true });
        expect(groups[1].mine).toBe(false);
        expect(accessLabel(groups[2])).toBe("renta");
    });

    it("incluida gana sobre renta en el mismo servicio", () => {
        const [group] = groupProviders([p("Amazon Prime Video", "rent"), p("Amazon Prime Video")]);
        expect(accessLabel(group)).toBeNull();
    });

    it("el catálogo para elegir no repite servicios", () => {
        const catalog = platformCatalog([p("Netflix"), p("Netflix Standard with Ads"), p("Disney Plus")]);
        expect(catalog.map((item) => item.key)).toEqual(["netflix", "disney+"]);
    });

    it("pone primero las populares y quita las tiendas", () => {
        const catalog = platformCatalog([p("Sun Nxt"), p("Apple TV Store"), p("HBO Max"), p("Netflix"), p("Amazon Video")]);
        expect(catalog.map((item) => item.name)).toEqual(["Netflix", "HBO Max", "Sun Nxt"]);
        expect(catalog.map((item) => item.popular)).toEqual([true, true, false]);
    });
});

import { matchesQuery } from "./text";

describe("buscar en una lista", () => {
    it("ignora acentos y mayúsculas", () => {
        expect(matchesQuery({ title: "El Señor de los Anillos" }, "senor")).toBe(true);
        expect(matchesQuery({ title: "Amélie" }, "AMELIE")).toBe(true);
        expect(matchesQuery({ title: "Dune" }, "duna")).toBe(false);
    });

    it("también busca en el título original", () => {
        expect(matchesQuery({ title: "Duna", originalTitle: "Dune" }, "dune")).toBe(true);
    });

    it("sin texto, todo pasa", () => {
        expect(matchesQuery({ title: "X" }, "  ")).toBe(true);
    });
});
