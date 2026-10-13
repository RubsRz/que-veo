import { useEffect, useRef, useState } from "react";

const THRESHOLD = 90; // píxeles para que el gesto cuente como decisión
const FLICK = 0.5; // px por ms: un manotazo rápido decide aunque no llegue al umbral
const TAP = 10; // si te moviste menos que esto, fue un toque
const HOLD = 420; // ms para que un toque largo abra el póster

const DIRECTIONS = { right: "liked", left: "skipped", up: "watchlist" };

/**
 * La tarjeta de la baraja.
 *
 * Gestos: → ya la vi (calificar) · ← no la he visto · ↑ quiero verla
 *         un toque abre la ficha · dejar el dedo encima abre el póster completo
 *
 * Está escrita a prueba de iOS, que cancela el toque en cuanto cree que vas a
 * hacer scroll:
 *   · el arrastre se escucha en `window`, no en la tarjeta, así que el "soltaste"
 *     llega aunque el dedo salga del elemento;
 *   · cualquier cancelación (pointercancel, cambiar de app, perder el foco)
 *     regresa la tarjeta a su lugar en vez de dejarla a medias;
 *   · mientras arrastras no se re-dibuja nada: se mueve el nodo directo, por eso
 *     va fluido hasta en un teléfono viejo.
 */
export default function SwipeCard({ item, onDecide, onOpen, onPoster, onFriends, genreNames, friends = null }) {
    const card = useRef(null);
    const stamps = useRef({});
    const gesture = useRef(null);
    const holdTimer = useRef(null);
    const [dragging, setDragging] = useState(false);
    const [leaving, setLeaving] = useState(null);

    // Cada tarjeta nueva arranca limpia
    useEffect(() => {
        setLeaving(null);
        paint(0, 0);
        return () => clearTimeout(holdTimer.current);
    }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

    function paint(x, y, animate = false) {
        const node = card.current;
        if (!node) return;
        node.style.transition = animate ? "transform 0.26s cubic-bezier(0.2, 1.2, 0.4, 1)" : "none";
        node.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${x / 26}deg)`;

        const show = (name, value) => {
            const stamp = stamps.current[name];
            if (stamp) stamp.style.opacity = String(Math.min(1, Math.max(0, value)));
        };
        const sideways = Math.abs(x) > Math.abs(y);
        show("liked", sideways ? x / THRESHOLD : 0);
        show("skipped", sideways ? -x / THRESHOLD : 0);
        show("watchlist", sideways ? 0 : -y / THRESHOLD);
    }

    /** Pase lo que pase, la tarjeta vuelve a su sitio y se olvida del gesto. */
    function reset() {
        clearTimeout(holdTimer.current);
        gesture.current = null;
        setDragging(false);
        paint(0, 0, true);
    }

    function start(event) {
        if (leaving || event.button > 0) return;
        gesture.current = { x: event.clientX, y: event.clientY, t: Date.now(), moved: false, id: event.pointerId };
        setDragging(true);
        holdTimer.current = setTimeout(() => {
            if (gesture.current && !gesture.current.moved) {
                reset();
                onPoster();
            }
        }, HOLD);
    }

    // El arrastre vive en window: así el "soltaste" llega siempre
    useEffect(() => {
        if (!dragging) return;

        const move = (event) => {
            const g = gesture.current;
            if (!g || (g.id != null && event.pointerId !== g.id)) return;
            const x = event.clientX - g.x;
            const y = event.clientY - g.y;
            if (!g.moved && Math.hypot(x, y) > TAP) {
                g.moved = true;
                clearTimeout(holdTimer.current);
            }
            if (event.cancelable) event.preventDefault();
            paint(x, y);
        };

        const up = (event) => {
            const g = gesture.current;
            if (!g || (g.id != null && event.pointerId !== g.id)) return;
            const x = event.clientX - g.x;
            const y = event.clientY - g.y;
            const elapsed = Math.max(1, Date.now() - g.t);
            const speed = Math.hypot(x, y) / elapsed;
            clearTimeout(holdTimer.current);
            gesture.current = null;
            setDragging(false);

            if (!g.moved) {
                paint(0, 0);
                onOpen(); // un toque abre la ficha
                return;
            }

            const sideways = Math.abs(x) > Math.abs(y);
            const distance = sideways ? Math.abs(x) : Math.abs(y);
            const direction = sideways ? (x > 0 ? "right" : "left") : y > 0 ? "down" : "up";
            // Hacia abajo no hay acción: la tarjeta se regresa
            if ((distance < THRESHOLD && speed < FLICK) || !DIRECTIONS[direction]) {
                paint(0, 0, true);
                return;
            }
            fly(DIRECTIONS[direction], direction);
        };

        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", reset);
        window.addEventListener("blur", reset);
        document.addEventListener("visibilitychange", reset);
        return () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", reset);
            window.removeEventListener("blur", reset);
            document.removeEventListener("visibilitychange", reset);
        };
    }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

    /** La tarjeta sale volando y hasta entonces se avisa la decisión. */
    function fly(decision, direction) {
        setLeaving(decision);
        const node = card.current;
        if (node) {
            const away = { right: ["130%", "0"], left: ["-130%", "0"], up: ["0", "-130%"], down: ["0", "130%"] }[direction];
            node.style.transition = "transform 0.22s ease-in, opacity 0.22s ease-in";
            node.style.transform = `translate3d(${away[0]}, ${away[1]}, 0) rotate(${direction === "right" ? 14 : direction === "left" ? -14 : 0}deg)`;
            node.style.opacity = "0.2";
        }
        if (navigator.vibrate) navigator.vibrate(12);
        setTimeout(() => onDecide(decision), 190);
    }

    return (
        <article ref={card} className="card" onPointerDown={start}>
            {item.poster ? (
                <img className="card-poster" src={item.poster} alt="" draggable="false" />
            ) : (
                <div className="card-fallback">
                    <p>{item.title}</p>
                </div>
            )}

            {item.resurfaced && <p className="card-flag">La descartaste, pero creo que te puede gustar</p>}

            {friends && (
                <button
                    type="button"
                    className={`friend-bubble is-${friends.kind}`}
                    // El toque es de la burbuja, no de la tarjeta
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        onFriends(friends.people);
                    }}
                    aria-label={friends.text}
                    title={friends.text}
                >
                    {friends.people.slice(0, friends.people.length > 3 ? 2 : 3).map((person) => (
                        <span key={person.uid} className="bubble-face">
                            {person.photo ? (
                                <img src={person.photo} alt="" referrerPolicy="no-referrer" />
                            ) : (
                                <i>{(person.name ?? "?").slice(0, 1).toUpperCase()}</i>
                            )}
                        </span>
                    ))}
                    {friends.people.length > 3 && <span className="bubble-more">+{friends.people.length - 2}</span>}
                </button>
            )}

            <span ref={(node) => (stamps.current.liked = node)} className="stamp stamp-like">Ya la vi</span>
            <span ref={(node) => (stamps.current.skipped = node)} className="stamp stamp-nope">No la he visto</span>
            <span ref={(node) => (stamps.current.watchlist = node)} className="stamp stamp-watch">Quiero verla</span>

            <div className="card-info">
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
