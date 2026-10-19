/** Para comparar texto como lo escribe la gente: sin acentos, sin mayúsculas. */
export const fold = (value = "") =>
    value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim();

/** ¿El título contiene lo que buscas? "senor" encuentra "El Señor de los Anillos". */
export function matchesQuery(item, query) {
    const wanted = fold(query);
    if (!wanted) return true;
    return [item.title, item.originalTitle].some((text) => text && fold(text).includes(wanted));
}
