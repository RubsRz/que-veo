import { useRef } from "react";

/**
 * Estrellas de media en media: cada estrella tiene dos mitades, así que se puede
 * dar 4.5. La parte dorada se recorta por porcentaje, por eso una media estrella
 * se ve exactamente a la mitad.
 */
const STAR = "M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z";

function One({ fill, size }) {
    return (
        <span className="star" style={{ width: size, height: size }}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={STAR} className="star-bg" />
            </svg>
            <span className="star-fill" style={{ width: `${fill * 100}%` }}>
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size }}>
                    <path d={STAR} />
                </svg>
            </span>
        </span>
    );
}

/**
 * Con `onDraft`, arrastrar el dedo sobre las estrellas va ajustando la calificación
 * sin guardarla: así se ve exactamente si vas en 4, 4.5 o 5, y se confirma aparte.
 * Un toque simple sí guarda de una vez, para no perder la rapidez cuando no
 * necesitas afinar.
 *
 * El final del gesto se escucha en `window` y también por `touchend`, porque hay
 * navegadores que mandan el "apretaste" y nunca el "soltaste".
 */
export default function Stars({ value = 0, onChange = null, onDraft = null, size = 34, label = "Calificación" }) {
    const stars = [1, 2, 3, 4, 5];
    const row = useRef(null);
    const drag = useRef(null);
    const listeners = useRef(null);
    const dragEndedAt = useRef(0); // para ignorar el clic que llega tras un arrastre

    /**
     * De la posición del dedo al valor, de media en media. Se mide de la primera
     * a la última estrella, no del contenedor: si no, los márgenes de los lados
     * corren la cuenta y tocar la quinta estrella daba 4.5.
     */
    const valueAt = (clientX) => {
        const first = row.current?.firstElementChild?.getBoundingClientRect();
        const last = row.current?.lastElementChild?.getBoundingClientRect();
        if (!first || !last) return 0;
        const ratio = (clientX - first.left) / (last.right - first.left);
        return Math.min(5, Math.max(0.5, Math.ceil(ratio * 10) / 2));
    };

    function stop() {
        const off = listeners.current;
        listeners.current = null;
        if (!off) return;
        window.removeEventListener("pointermove", off.move);
        window.removeEventListener("pointerup", off.up);
        window.removeEventListener("pointercancel", off.cancel);
        window.removeEventListener("touchmove", off.touchMove);
        window.removeEventListener("touchend", off.touchEnd);
    }

    function track(clientX) {
        const info = drag.current;
        if (!info) return;
        if (Math.abs(clientX - info.x) > 6) info.moved = true;
        info.value = valueAt(clientX);
        onDraft(info.value);
    }

    /** Suelta el gesto: solo guarda si fue un toque, no un arrastre. */
    function finish(clientX) {
        const info = drag.current;
        drag.current = null;
        stop();
        if (!info) return;
        dragEndedAt.current = Date.now();
        if (clientX != null) onDraft(valueAt(clientX)); // queda listo; lo confirmas tú
    }

    /** Un toque sobre media estrella; se ignora si viene de soltar un arrastre. */
    function pick(valor) {
        if (Date.now() - dragEndedAt.current < 500) return;
        (onDraft ?? onChange)(valor);
    }

    function down(event) {
        if (!onDraft || drag.current) return;
        drag.current = { x: event.clientX, moved: false, value: valueAt(event.clientX) };
        onDraft(drag.current.value);

        const off = {
            move: (e) => {
                if (e.cancelable) e.preventDefault();
                track(e.clientX);
            },
            up: (e) => finish(e.clientX),
            // Si el navegador corta el gesto sin que te hayas movido, fue un toque
            cancel: () => finish(),
            touchMove: (e) => track(e.touches[0].clientX),
            touchEnd: (e) => finish(e.changedTouches[0].clientX),
        };
        listeners.current = off;
        window.addEventListener("pointermove", off.move, { passive: false });
        window.addEventListener("pointerup", off.up);
        window.addEventListener("pointercancel", off.cancel);
        window.addEventListener("touchmove", off.touchMove, { passive: true });
        window.addEventListener("touchend", off.touchEnd);
    }

    // Sin ninguna de las dos, solo se pinta
    if (!onChange && !onDraft) {
        return (
            <span className="stars-view" role="img" aria-label={`${value} de 5 estrellas`}>
                {stars.map((index) => (
                    <One key={index} fill={Math.min(1, Math.max(0, value - index + 1))} size={size} />
                ))}
            </span>
        );
    }

    return (
        <div
            className={`stars ${onDraft ? "is-draggable" : ""}`}
            role="group"
            aria-label={label}
            ref={row}
            onPointerDown={down}
        >
            {stars.map((index) => (
                <span key={index} className="star-slot">
                    <One fill={Math.min(1, Math.max(0, value - index + 1))} size={size} />
                    {/* Siguen ahí para el teclado; con arrastre dejan pasar el gesto */}
                    <button
                        type="button"
                        className="star-hit is-half"
                        onClick={() => pick(index - 0.5)}
                        aria-label={`${index - 0.5} estrellas`}
                    />
                    <button
                        type="button"
                        className="star-hit is-full"
                        onClick={() => pick(index)}
                        aria-label={`${index} estrellas`}
                    />
                </span>
            ))}
        </div>
    );
}
