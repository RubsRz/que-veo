import { useRef, useState } from "react";

const THRESHOLD = 110; // píxeles que hay que arrastrar para que cuente

/**
 * Tarjeta que se arrastra con el dedo o el mouse:
 *   derecha → me gustó   ·  izquierda → no me interesa
 *   arriba  → pendiente  ·  abajo     → la vi y no me gustó
 */
export default function SwipeCard({ item, onDecide, onOpen, genreNames }) {
    const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
    const [leaving, setLeaving] = useState(null);
    const start = useRef(null);

    const direction = (() => {
        const { x, y } = drag;
        if (Math.abs(x) > Math.abs(y)) {
            if (x > THRESHOLD) return "liked";
            if (x < -THRESHOLD) return "skipped";
        } else {
            if (y < -THRESHOLD) return "watchlist";
            if (y > THRESHOLD) return "disliked";
        }
        return null;
    })();

    function down(event) {
        start.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ x: 0, y: 0, active: true });
    }

    function move(event) {
        if (!start.current) return;
        setDrag({ x: event.clientX - start.current.x, y: event.clientY - start.current.y, active: true });
    }

    function up() {
        if (!start.current) return;
        const moved = Math.hypot(drag.x, drag.y);
        start.current = null;

        if (direction) {
            setLeaving(direction);
            setTimeout(() => {
                onDecide(direction);
                setLeaving(null);
                setDrag({ x: 0, y: 0, active: false });
            }, 180);
            return;
        }
        if (moved < 6) onOpen(); // fue un toque, no un arrastre
        setDrag({ x: 0, y: 0, active: false });
    }

    const exit = { liked: "120%", skipped: "-120%", watchlist: "0", disliked: "0" }[leaving];
    const exitY = { liked: "0", skipped: "0", watchlist: "-120%", disliked: "120%" }[leaving];

    const style = leaving
        ? { transform: `translate(${exit}, ${exitY}) rotate(${leaving === "liked" ? 18 : leaving === "skipped" ? -18 : 0}deg)`, transition: "transform 0.18s ease-in", opacity: 0.4 }
        : {
              transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 22}deg)`,
              transition: drag.active ? "none" : "transform 0.25s cubic-bezier(0.2, 1.3, 0.4, 1)",
          };

    const opacity = (test) => (direction === test ? 1 : Math.min(1, Math.hypot(drag.x, drag.y) / THRESHOLD) * (0.0));

    return (
        <article className="card" style={style} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            {item.poster ? (
                <img className="card-poster" src={item.poster} alt="" draggable="false" />
            ) : (
                <div className="card-fallback">
                    <p>
                        <strong>{item.title}</strong>
                        <br />
                        (sin póster en modo demo)
                    </p>
                </div>
            )}

            <span className="stamp stamp-like" style={{ opacity: direction === "liked" ? 1 : opacity("liked") }}>Me gustó</span>
            <span className="stamp stamp-nope" style={{ opacity: direction === "skipped" ? 1 : opacity("skipped") }}>Paso</span>
            <span className="stamp stamp-watch" style={{ opacity: direction === "watchlist" ? 1 : opacity("watchlist") }}>Pendiente</span>
            <span className="stamp stamp-bad" style={{ opacity: direction === "disliked" ? 1 : opacity("disliked") }}>No me gustó</span>

            <div className="card-shade">
                <h2 className="card-title">{item.title}</h2>
                <p className="card-meta">
                    {item.year && <span>{item.year}</span>}
                    {item.rating ? <span>★ {item.rating}</span> : null}
                    {item.type === "tv" && <span>Serie</span>}
                </p>
                {item.overview && <p className="card-overview">{item.overview}</p>}
                <div className="card-chips">
                    {(item.genreIds ?? []).slice(0, 3).map((id) => (
                        <span key={id} className="chip">{genreNames[id] ?? "—"}</span>
                    ))}
                </div>
                <button type="button" className="card-link" onClick={(event) => { event.stopPropagation(); onOpen(); }}>
                    Ver ficha completa
                </button>
            </div>
        </article>
    );
}
