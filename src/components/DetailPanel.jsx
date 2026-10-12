import TitleDetails from "./TitleDetails";

/** La ficha en escritorio: panel fijo a la derecha, siempre visible. */
export default function DetailPanel({ item, entry, onDecide, onForget }) {
    if (!item) {
        return (
            <aside className="detail-panel">
                <div className="empty">
                    <b>Sin títulos por ahora</b>
                    <p>Cuando haya una tarjeta en la baraja, aquí verás su ficha completa.</p>
                </div>
            </aside>
        );
    }

    return (
        <aside className="detail-panel">
            <TitleDetails item={item} entry={entry} onDecide={onDecide} onForget={onForget} />
        </aside>
    );
}
