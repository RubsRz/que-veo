import { useRef } from "react";

/**
 * Dejar el dedo encima abre el menú de un título (y en escritorio, el clic
 * derecho). Si el dedo se mueve es scroll, no long-press; y si sí se disparó, el
 * toque que sigue no cuenta como clic.
 */
export function useLongPress(onLongPress, { delay = 450 } = {}) {
    const timer = useRef(null);
    const origin = useRef(null);
    const fired = useRef(false);

    const cancel = () => {
        clearTimeout(timer.current);
        timer.current = null;
    };

    return {
        onPointerDown(event) {
            if (event.button > 0) return;
            fired.current = false;
            origin.current = { x: event.clientX, y: event.clientY };
            cancel();
            timer.current = setTimeout(() => {
                fired.current = true;
                navigator.vibrate?.(10);
                onLongPress();
            }, delay);
        },
        onPointerMove(event) {
            if (!timer.current || !origin.current) return;
            const moved = Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y);
            if (moved > 10) cancel();
        },
        onPointerUp: cancel,
        onPointerCancel: cancel,
        onPointerLeave: cancel,
        onContextMenu(event) {
            event.preventDefault();
            cancel();
            if (!fired.current) onLongPress();
            fired.current = true;
        },
        onClickCapture(event) {
            if (!fired.current) return;
            fired.current = false;
            event.preventDefault();
            event.stopPropagation();
        },
    };
}
