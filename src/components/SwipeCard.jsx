import { useRef, useState } from "react";

const THRESHOLD = 110; // píxeles para que el gesto cuente como decisión
const PULL_OPEN = 140; // cuánto hay que jalar hacia arriba para abrir la ficha

/**
 * Tarjeta de la baraja. El póster se ve completo porque la tarjeta tiene su misma
 * proporción (2:3), y encima va la info con degradado.
 *
 * Gestos:
 *   derecha → me gustó   ·  izquierda → no me interesa
 *   abajo   → la vi y no me gustó
 *   arriba  → jala la ficha completa, que sigue al dedo; si sueltas antes, se queda
 *             en pendiente solo si pasaste el umbral lateral de arriba.
 */
export default function SwipeCard({ item, onDecide, onOpen, onPull, onPoster, genreNames, friends = null }) {
    const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
    const [leaving, setLeaving] = useState(null);
    const start = useRef(null);
    const pulling = useRef(false);

    const direction = (() => {
        const { x, y } = drag;
        if (Math.abs(x) > Math.abs(y)) {
            if (x > THRESHOLD) return "liked";
            if (x < -THRESHOLD) return "skipped";
        } else if (y > THRESHOLD) {
            return "disliked";
        }
        return null;
    })();

    function down(event) {
        start.current = { x: event.clientX, y: event.clientY, fromInfo: event.target.closest(".card-info") != null };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ x: 0, y: 0, active: true });
    }

    function move(event) {
        if (!start.current) return;
        const x = event.clientX - start.current.x;
        const y = event.clientY - start.current.y;

        // Jalar hacia arriba abre la ficha, que va siguiendo el dedo
        const pullingUp = y < -10 && Math.abs(y) > Math.abs(x);
        if (pullingUp && (start.current.fromInfo || Math.abs(y) > 40)) {
            pulling.current = true;
            onPull(Math.min(1, -y / PULL_OPEN));
            setDrag({ x: 0, y: 0, active: true });
            return;
        }
        setDrag({ x, y, active: true });
    }

    function up() {
        if (!start.current) return;
        const moved = Math.hypot(drag.x, drag.y);
        const wasPulling = pulling.current;
        start.current = null;
        pulling.current = false;

        if (wasPulling) {
            onPull(null); // que decida si se abre o se regresa
            setDrag({ x: 0, y: 0, active: false });
            return;
        }

        if (direction) {
            setLeaving(direction);
            setTimeout(() => {
                onDecide(direction);
                setLeaving(null);
                setDrag({ x: 0, y: 0, active: false });
            }, 170);
            return;
        }
        if (moved < 6) onPoster(); // un toque muestra el póster completo
        setDrag({ x: 0, y: 0, active: false });
    }

    const exitX = { liked: "120%", skipped: "-120%", disliked: "0" }[leaving];
    const exitY = { liked: "0", skipped: "0", disliked: "120%" }[leaving];

    const style = leaving
        ? {
              transform: `translate(${exitX}, ${exitY}) rotate(${leaving === "liked" ? 16 : leaving === "skipped" ? -16 : 0}deg)`,
              transition: "transform 0.17s ease-in",
              opacity: 0.35,
          }
        : {
              transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 24}deg)`,
              transition: drag.active ? "none" : "transform 0.25s cubic-bezier(0.2, 1.3, 0.4, 1)",
          };

    const stamp = (test) => ({ opacity: direction === test ? 1 : 0 });

    return (
        <article
            className="card"
            style={style}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
        >
            {item.poster ? (
                <img className="card-poster" src={item.poster} alt="" draggable="false" />
            ) : (
                <div className="card-fallback">
                    <p>{item.title}</p>
                </div>
            )}

            {item.resurfaced && <p className="card-flag">La descartaste, pero creo que te puede gustar</p>}

            <span className="stamp stamp-like" style={stamp("liked")}>Me gustó</span>
            <span className="stamp stamp-nope" style={stamp("skipped")}>Paso</span>
            <span className="stamp stamp-bad" style={stamp("disliked")}>No me gustó</span>

            <div className="card-info">
                <span className="grabber grabber-top" aria-hidden="true" />
                {friends && (
                    <p className={`card-friends is-${friends.kind}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M9 11.5a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM2.8 19a6.2 6.2 0 0112.4 0M16 5.6a3 3 0 010 5.8M17.5 19a6 6 0 00-1.2-3.6" />
                        </svg>
                        {friends.text}
                        {friends.stars ? ` · ${friends.stars}★` : ""}
                    </p>
                )}
                <h2 className="card-title">{item.title}</h2>
                <p className="card-meta">
                    {item.year && <span>{item.year}</span>}
                    {item.rating ? <span>★ {item.rating}</span> : null}
                    {(item.genreIds ?? []).slice(0, 2).map((id) => (
                        <span key={id}>{genreNames[id] ?? ""}</span>
                    ))}
                </p>
            </div>
        </article>
    );
}
