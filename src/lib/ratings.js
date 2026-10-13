/**
 * Qué significa cada calificación. La escala va de media en media estrella y
 * cada paso tiene nombre, para que al calificar sepas qué estás diciendo.
 */
export const SCALE = [
    { value: 0.5, group: "Basura", title: "Desastre", hint: "Incoherente, sin valor técnico ni artístico" },
    { value: 1, group: "Basura", title: "Muy mala", hint: "Fallas graves en guion, dirección o actuaciones" },
    { value: 1.5, group: "Basura", title: "Mala", hint: "Algún detalle salvable, pero es un fallo general" },
    { value: 2, group: "Meh", title: "Mediocre", hint: "Aburrida o genérica, con problemas de ritmo" },
    { value: 2.5, group: "Meh", title: "Promedio", hint: "Ni fu ni fa: entretiene por momentos, pero se olvida" },
    { value: 3, group: "Cumplidor", title: "Buena", hint: "Bien hecha, cumple lo que promete y se disfruta" },
    { value: 3.5, group: "Cumplidor", title: "Notable", hint: "Destaca en varias cosas: dirección, actuaciones, foto" },
    { value: 4, group: "Cumplidor", title: "Excelente", hint: "Muy recomendable, con mucho nivel" },
    { value: 4.5, group: "Joyota", title: "Casi maestra", hint: "Rozando la perfección; deja huella" },
    { value: 5, group: "Joyota", title: "Obra maestra", hint: "Imprescindible, un referente de su género" },
];

const BY_VALUE = new Map(SCALE.map((step) => [step.value, step]));

export const ratingInfo = (value) => BY_VALUE.get(value) ?? null;

/** De 3★ para arriba te gustó; de 2.5★ para abajo, no. */
export const likedIt = (entry) => (entry.stars ?? 3) >= 3;

/**
 * Parte lo calificado en dos listas. Las viejas de "no me gustó" (cuando era un
 * botón) caen del lado que les toca aunque no tengan estrellas.
 */
export function splitRated(lists) {
    const rated = [...lists.liked, ...lists.disliked];
    return {
        liked: rated.filter((entry) => entry.decision !== "disliked" && likedIt(entry)),
        disliked: rated.filter((entry) => entry.decision === "disliked" || !likedIt(entry)),
    };
}

/** De 0.5 a 5 estrellas a un peso de -1 a 1, para el perfil de gustos. */
export const ratingWeight = (stars) => Math.max(-1, Math.min(1, (stars - 2.75) / 2.25));
