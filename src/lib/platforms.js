/**
 * Las plataformas como las ve una persona, no como las lista TMDB. TMDB trae cada
 * variante por separado ("Netflix" y "Netflix Standard with Ads", "HBO Max" y "HBO
 * Max Amazon Channel", renta y compra de la misma tienda), y en la ficha salían
 * once chips para cuatro servicios. Aquí se juntan.
 */

// Lo que se le pega al nombre del servicio y no lo hace otro servicio
const VARIANTS = [
    /\s+(standard|basic|premium)?\s*with ads$/,
    /\s+(amazon|apple tv|roku premium)\s+channel$/,
    /\s+channel$/,
];

// Mismo servicio, distinto nombre según el país o la época
const ALIASES = {
    "prime video": "amazon prime video",
    max: "hbo max",
    "disney plus": "disney+",
    "paramount plus": "paramount+",
    "apple tv plus": "apple tv+",
};

/** La llave con la que se reconoce un servicio, sin importar la variante. */
export function platformKey(name = "") {
    let key = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim();
    for (const pattern of VARIANTS) key = key.replace(pattern, "");
    return ALIASES[key] ?? key;
}

/**
 * Agrupa las plataformas de un título: una por servicio, con lo que se puede
 * hacer ahí (incluida, renta, compra) y si es de las tuyas. Las tuyas primero,
 * luego lo incluido en suscripción y al final lo que se paga aparte.
 */
export function groupProviders(providers = [], mine = []) {
    const groups = new Map();
    providers.forEach((provider, index) => {
        const key = platformKey(provider.name);
        const group = groups.get(key) ?? { key, name: provider.name, logo: provider.logo, order: index, modes: new Set() };
        // El nombre que se muestra es el del servicio base, no el de la variante
        if (platformKey(provider.name) === provider.name.toLowerCase() || provider.name.length < group.name.length) {
            group.name = provider.name;
            group.logo = provider.logo ?? group.logo;
        }
        group.modes.add(provider.mode ?? "flatrate");
        groups.set(key, group);
    });

    return [...groups.values()]
        .map(({ modes, ...group }) => ({
            ...group,
            included: modes.has("flatrate"),
            rent: modes.has("rent"),
            buy: modes.has("buy"),
            mine: mine.includes(group.key),
        }))
        .sort((a, b) => b.mine - a.mine || b.included - a.included || a.order - b.order);
}

/** Lo que dice el chip después del nombre: nada si viene incluida. */
export function accessLabel(group) {
    if (group.included) return null;
    if (group.rent && group.buy) return "renta o compra";
    return group.rent ? "renta" : "compra";
}

// Las que más se usan en México, en ese orden: salen primero al elegir las tuyas
const POPULAR = [
    "netflix",
    "amazon prime video",
    "disney+",
    "hbo max",
    "apple tv+",
    "paramount+",
    "vix",
    "claro video",
    "mercado play",
    "crunchyroll",
    "mubi",
    "pluto tv",
];

// Tiendas de renta o compra: no son algo que "tengas"
const STORES = /store$|^amazon video$|^google play|^microsoft store|^youtube$/;

/**
 * El catálogo de plataformas para elegir las tuyas: una por servicio, sin
 * tiendas, con las populares primero (marcadas para enseñar solo esas de inicio).
 */
export function platformCatalog(providers = []) {
    const rank = (key) => (POPULAR.includes(key) ? POPULAR.indexOf(key) : POPULAR.length);
    return groupProviders(providers.map((provider) => ({ ...provider, mode: "flatrate" })))
        .filter((group) => !STORES.test(group.key))
        .map(({ key, name, logo, order }) => ({ key, name, logo, order, popular: POPULAR.includes(key) }))
        .sort((a, b) => rank(a.key) - rank(b.key) || a.order - b.order)
        .map(({ order: _order, ...platform }) => platform);
}
