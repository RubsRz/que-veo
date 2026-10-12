import { useRef, useState } from "react";

const THRESHOLD = 110; // píxeles para que el gesto cuente como decisión
const PULL_TO_OPEN = 70; // cuánto hay que seguir jalando la ficha para abrirla completa

/**
 * Tarjeta de la baraja: el póster se ve completo y debajo va la mini ficha,
 * que se desliza. Si al llegar al final sigues jalando, se abre la ficha completa.
 *
 * Gestos sobre el póster:
 *   derecha → me gustó   ·  izquierda → no me interesa
 *   arriba  → pendiente  ·  abajo     → la vi y no me gustó
 */
export default function SwipeCard({ item, onDecide, onOpen, genreNames }) {
    const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
    const [leaving, setLeaving] = useState(null);
    const [pull, setPull] = useState(0);
    const start = useRef(null);
    const info = useRef(null);
    const pullStart = useRef(null);

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
            }, 170);
            return;
        }
        if (moved < 6) onOpen(); // fue un toque, no un arrastre
        setDrag({ x: 0, y: 0, active: false });
    }

    // --- Jalar la mini ficha hacia arriba, ya estando al final, abre la completa ---
    function infoDown(event) {
        const element = info.current;
        const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 4;
        pullStart.current = atBottom ? event.clientY : null;
    }

    function infoMove(event) {
        if (pullStart.current == null) return;
        const delta = pullStart.current - event.clientY;
        setPull(Math.max(0, Math.min(PULL_TO_OPEN + 20, delta)));
    }

    function infoUp() {
        if (pull >= PULL_TO_OPEN) onOpen();
        pullStart.current = null;
        setPull(0);
    }

    const exitX = { liked: "120%", skipped: "-120%", watchlist: "0", disliked: "0" }[leaving];
    const exitY = { liked: "0", skipped: "0", watchlist: "-120%", disliked: "120%" }[leaving];

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

    const stampOpacity = (test) => (direction === test ? 1 : 0);

    return (
        <article className="card" style={style}>
            <div className="card-media" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
                {item.poster ? (
                    <img className="card-poster" src={item.poster} alt="" draggable="false" />
                ) : (
                    <div className="card-fallback">
                        <p>{item.title}</p>
                    </div>
                )}

                {item.resurfaced && <p className="card-flag">↩︎ La descartaste, pero creo que te puede gustar</p>}

                <span className="stamp stamp-like" style={{ opacity: stampOpacity("liked") }}>Me gustó</span>
                <span className="stamp stamp-nope" style={{ opacity: stampOpacity("skipped") }}>Paso</span>
                <span className="stamp stamp-watch" style={{ opacity: stampOpacity("watchlist") }}>Pendiente</span>
                <span className="stamp stamp-bad" style={{ opacity: stampOpacity("disliked") }}>No me gustó</span>
            </div>

            <div
                className="card-info"
                ref={info}
                onPointerDown={infoDown}
                onPointerMove={infoMove}
                onPointerUp={infoUp}
                onPointerCancel={infoUp}
                style={{ transform: `translateY(${-pull / 3}px)` }}
            >
                <h2 className="card-title">{item.title}</h2>
                <p className="card-meta">
                    {item.year && <span>{item.year}</span>}
                    {item.rating ? <span>★ {item.rating}</span> : null}
                    {item.type === "tv" && <span>Serie</span>}
                    {(item.genreIds ?? []).slice(0, 2).map((id) => (
                        <span key={id}>{genreNames[id] ?? ""}</span>
                    ))}
                </p>
                {item.overview && <p className="card-overview">{item.overview}</p>}
                <p className="card-more">
                    {pull >= PULL_TO_OPEN ? "Suelta para abrir la ficha" : "Sigue deslizando para ver la ficha completa"}
                </p>
            </div>
        </article>
    );
}
