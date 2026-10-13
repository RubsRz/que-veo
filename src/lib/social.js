/**
 * Lo social, sin Firebase de por medio: comparar gustos, ver quién calificó qué
 * y proponer qué ver juntos. Todo son funciones puras para poder probarlas.
 */

/** Las decisiones que dicen algo de tus gustos (lo descartado no cuenta). */
const OPINIONS = ["liked", "disliked", "watchlist"];

/** Un mismo par de personas siempre da el mismo id, sin importar quién invita. */
export function friendshipId(a, b) {
    return [a, b].sort().join("_");
}

/** Deja un usuario como se guarda: minúsculas, sin acentos ni símbolos raros. */
export function normalizeUsername(value = "") {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9._-]/g, "")
        .replace(/^[._-]+/, "")
        .slice(0, 20);
}

export const usernameError = (value) => {
    if (value.length < 3) return "Mínimo 3 caracteres";
    if (value.length > 20) return "Máximo 20 caracteres";
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) return "Solo letras, números, punto, guion y guion bajo";
    return null;
};

/** El usuario que se propone al entrar: lo que va antes del @ de tu correo. */
export const suggestUsername = (email = "", random = Math.random) => {
    const base = normalizeUsername(email.split("@")[0] ?? "");
    if (base.length >= 3) return base;
    return `cinefilo${Math.floor(random() * 9000) + 1000}`;
};

/** Código para compartir: 6 caracteres sin los que se confunden (O/0, I/1). */
export function makeCode(random = Math.random) {
    const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i += 1) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
    return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export const normalizeCode = (code) =>
    (code ?? "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6)
        .replace(/^(.{3})(.{1,3})$/, "$1-$2");

/**
 * Quién de tus amigos opinó de cada título.
 * `libraries` es { uidDelAmigo: { idDelTítulo: entrada } } y `friends` la lista
 * con sus nombres. Devuelve un mapa: id del título → opiniones de tus amigos.
 */
export function ratingsByItem(libraries, friends) {
    const byUid = new Map(friends.map((friend) => [friend.uid, friend]));
    const result = {};

    for (const [uid, library] of Object.entries(libraries ?? {})) {
        const friend = byUid.get(uid);
        if (!friend) continue;

        for (const entry of Object.values(library ?? {})) {
            if (!OPINIONS.includes(entry.decision)) continue;
            (result[entry.id] ??= []).push({
                uid,
                name: friend.name,
                photo: friend.photo ?? null,
                decision: entry.decision,
                stars: entry.stars ?? null,
                item: entry,
            });
        }
    }

    // Primero quien la vio y le gustó, y entre esos, quien le puso más estrellas
    const rank = { liked: 0, watchlist: 1, disliked: 2 };
    for (const list of Object.values(result)) {
        list.sort((a, b) => rank[a.decision] - rank[b.decision] || (b.stars ?? 0) - (a.stars ?? 0));
    }
    return result;
}

/** Texto corto para la tarjeta: "A Ana le gustó" / "A Ana y 2 más les gustó". */
export function friendsBadge(opinions = []) {
    // Con la escala nueva, "le gustó" es de 3★ para arriba
    const liked = opinions.filter(
        (opinion) => opinion.decision === "liked" && (opinion.stars ?? 3) >= 3,
    );
    const pending = opinions.filter((opinion) => opinion.decision === "watchlist");
    const group = liked.length ? liked : pending;
    if (!group.length) return null;

    const [first] = group;
    const others = group.length - 1;
    const who = others ? `${first.name} y ${others} más` : first.name;
    const verb = liked.length
        ? others
            ? "les gustó"
            : "le gustó"
        : others
          ? "la tienen pendiente"
          : "la tiene pendiente";

    return {
        text: `A ${who} ${verb}`,
        stars: liked.length === 1 ? first.stars : null,
        kind: liked.length ? "liked" : "watchlist",
        people: group,
    };
}

/**
 * Qué tanto coinciden sus gustos: de los títulos que los dos vieron, en cuántos
 * opinaron igual. Con menos de tres en común no alcanza para decir nada.
 */
export function affinity(mine = {}, theirs = {}) {
    let shared = 0;
    let agree = 0;

    for (const entry of Object.values(mine)) {
        const other = theirs[entry.id];
        if (!other) continue;
        const a = entry.decision;
        const b = other.decision;
        if (!["liked", "disliked"].includes(a) || !["liked", "disliked"].includes(b)) continue;

        shared += 1;
        if (a !== b) continue;

        // Si los dos la calificaron, una diferencia de 3★ o más ya no es coincidir
        if (a === "liked" && entry.stars && other.stars && Math.abs(entry.stars - other.stars) >= 3) continue;
        agree += 1;
    }

    return { shared, agree, score: shared >= 3 ? Math.round((agree / shared) * 100) : null };
}

/**
 * Qué podrían ver juntos:
 *   - `both`: las que los dos tienen pendientes
 *   - `fromThem`: lo que a esa persona le encantó y tú no has visto
 *   - `forThem`: lo que a ti te encantó y esa persona no ha visto
 */
export function watchTogether(mine = {}, theirs = {}, { minStars = 4, limit = 12 } = {}) {
    const both = [];
    const fromThem = [];
    const forThem = [];

    for (const entry of Object.values(theirs)) {
        const own = mine[entry.id];
        if (entry.decision === "watchlist" && own?.decision === "watchlist") both.push(entry);
        else if (entry.decision === "liked" && (entry.stars ?? 5) >= minStars && !own) fromThem.push(entry);
    }

    for (const entry of Object.values(mine)) {
        if (entry.decision !== "liked") continue;
        if ((entry.stars ?? 5) < minStars) continue;
        if (!theirs[entry.id]) forThem.push(entry);
    }

    const byStars = (a, b) => (b.stars ?? 0) - (a.stars ?? 0) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    return {
        both: both.sort(byStars).slice(0, limit),
        fromThem: fromThem.sort(byStars).slice(0, limit),
        forThem: forThem.sort(byStars).slice(0, limit),
    };
}

/**
 * Las que más se repiten entre tus amigos y tú no has visto: lo que "todos
 * andan viendo" dentro de tu propio círculo.
 */
export function trendingAmongFriends(ratings = {}, mine = {}, { limit = 12 } = {}) {
    return Object.entries(ratings)
        .filter(([id]) => !mine[id])
        .map(([id, opinions]) => {
            const liked = opinions.filter((opinion) => opinion.decision === "liked");
            return {
                id,
                item: (liked[0] ?? opinions[0]).item,
                opinions,
                liked: liked.length,
                stars: average(liked.map((opinion) => opinion.stars)),
            };
        })
        .filter((row) => row.liked >= 2)
        .sort((a, b) => b.liked - a.liked || (b.stars ?? 0) - (a.stars ?? 0))
        .slice(0, limit);
}

const average = (values) => {
    const clean = values.filter(Boolean);
    if (!clean.length) return null;
    return Math.round((clean.reduce((sum, value) => sum + value, 0) / clean.length) * 10) / 10;
};

/** Las que ya vieron todos los de una lista en conjunto quedan hasta abajo. */
export const sortSharedItems = (items = []) =>
    [...items].sort(
        (a, b) => Number(Boolean(a.watched)) - Number(Boolean(b.watched)) || (b.addedAt ?? "").localeCompare(a.addedAt ?? ""),
    );
