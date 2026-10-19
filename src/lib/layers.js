import { useEffect, useRef } from "react";

// Todo lo que se abre encima (hojas, menús, el póster en grande), de abajo hacia
// arriba: con dos encimadas, Escape cierra solo la de arriba.
const layers = [];

/**
 * Registra una capa encima de la app: Escape la cierra solo si es la de hasta
 * arriba, y el fondo se queda quieto mientras haya alguna. Se cuentan las capas en
 * vez de guardar "cómo estaba" el fondo, porque pueden cerrarse en desorden.
 */
export function useLayer(onClose) {
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    });
    useEffect(() => {
        const me = {};
        layers.push(me);
        document.body.style.overflow = "hidden";
        const onKey = (event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            if (layers[layers.length - 1] === me) closeRef.current();
        };
        window.addEventListener("keydown", onKey, true);
        return () => {
            window.removeEventListener("keydown", onKey, true);
            layers.splice(layers.indexOf(me), 1);
            if (layers.length === 0) document.body.style.overflow = "";
        };
    }, []);
}
