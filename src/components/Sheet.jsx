import { useRef, useState } from "react";
import { useLayer } from "../lib/layers";

/**
 * La hoja que sube desde abajo. Todas las de la app pasan por aquí.
 *
 * Reglas que se siguen al pie de la letra, porque antes se atoraba en iPhone:
 *   1. Siempre hay una ✕ visible, fija arriba: nunca depende de hacer scroll.
 *   2. Se cierra de cuatro formas: la ✕, tocar afuera, Escape y jalarla hacia abajo.
 *   3. El gesto no puede dejarla a medias: si el dedo se va (iOS cancela el toque
 *      cuando cree que es scroll), vuelve sola a su sitio.
 *   4. Mientras está abierta, el fondo no se mueve, y al cerrar se restaura siempre.
 */
export default function Sheet({ title, subtitle, onClose, children, footer = null, full = false }) {
    const [drag, setDrag] = useState(0); // cuánto la llevas jalada hacia abajo
    const [dragging, setDragging] = useState(false); // sin transición mientras el dedo la mueve
    const start = useRef(null);
    const panel = useRef(null);

    useLayer(onClose);

    function down(event) {
        // Solo se jala desde el encabezado, para no pelearse con el scroll del contenido
        if (!event.target.closest(".sheet-head-bar")) return;
        start.current = { y: event.clientY, t: Date.now() };
        setDragging(true);
    }

    function move(event) {
        if (!start.current) return;
        const delta = event.clientY - start.current.y;
        setDrag(Math.max(0, delta));
    }

    function end() {
        if (!start.current) return;
        const quick = Date.now() - start.current.t < 300 && drag > 50;
        start.current = null;
        setDragging(false);
        if (drag > 140 || quick) onClose();
        else setDrag(0); // pase lo que pase, regresa a su sitio
    }

    return (
        <div className="sheet" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
            <section
                ref={panel}
                className={`sheet-card ${full ? "is-full" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                style={{
                    transform: drag ? `translateY(${drag}px)` : "",
                    transition: dragging ? "none" : "transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1)",
                }}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onLostPointerCapture={end}
            >
                <header className="sheet-head-bar">
                    <span className="sheet-grabber" aria-hidden="true" />
                    <div className="sheet-head-text">
                        {title && <h2>{title}</h2>}
                        {subtitle && <p className="sheet-meta">{subtitle}</p>}
                    </div>
                    <button type="button" className="sheet-close" onClick={onClose} aria-label="Cerrar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    </button>
                </header>

                <div className="sheet-body">{children}</div>

                {footer && <footer className="sheet-foot">{footer}</footer>}
            </section>
        </div>
    );
}
