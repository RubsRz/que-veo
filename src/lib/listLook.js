/**
 * Cómo se ve cada lista en conjunto: un emoji y un color, para distinguirlas de
 * un vistazo en el índice sin tener que leer el nombre.
 */
export const LIST_EMOJIS = ["🍿", "🎬", "📺", "👻", "😂", "💘", "🚀", "🕵️", "🧸", "🔥", "🌙", "🎉"];

export const LIST_COLORS = [
    { id: "rosa", value: "#f53b63" },
    { id: "morado", value: "#8b5cf6" },
    { id: "azul", value: "#3b82f6" },
    { id: "verde", value: "#22c55e" },
    { id: "ambar", value: "#f5b942" },
    { id: "naranja", value: "#f97316" },
];

export const DEFAULT_LOOK = { emoji: "🍿", color: LIST_COLORS[0].value };

/** Las listas viejas no traen emoji ni color: se les pone el de siempre. */
export const lookOf = (list) => ({
    emoji: list?.emoji ?? DEFAULT_LOOK.emoji,
    color: list?.color ?? DEFAULT_LOOK.color,
});
