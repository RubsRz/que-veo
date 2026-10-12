import TitleDetails from "./TitleDetails";

/** La ficha en celular: hoja que sube desde abajo y puede seguir al dedo. */
export default function DetailSheet({ item, entry, onClose, onDecide, onForget, offset = 0, dragging = false, friendOpinions = [], onShare = null }) {
    return (
        <div className="sheet" style={{ background: `rgba(0,0,0,${0.6 * (1 - offset)})` }} onClick={onClose}>
            <div
                className="sheet-card"
                style={{
                    transform: `translateY(${offset * 100}%)`,
                    transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)",
                    animation: "none",
                }}
                onClick={(event) => event.stopPropagation()}
            >
                <span className="sheet-grabber" aria-hidden="true" />
                <TitleDetails item={item} entry={entry} onDecide={onDecide} onForget={onForget} friendOpinions={friendOpinions} onShare={onShare} />
                <button type="button" className="btn btn-ghost btn-wide" style={{ marginTop: 10 }} onClick={onClose}>
                    Cerrar
                </button>
            </div>
        </div>
    );
}
