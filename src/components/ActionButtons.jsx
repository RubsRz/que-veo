/**
 * Botones de la baraja. Son tres, porque la calificación ya dice si te gustó o
 * no: para eso está la escala de media a cinco estrellas.
 */
const ICONS = {
    skip: <path d="M6 6l12 12M18 6L6 18" />,
    watch: (
        <>
            <circle cx="12" cy="12" r="8.2" />
            <path d="M12 7.5V12l3 1.8" />
        </>
    ),
    rate: <path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.9-3.8 5.4-.8z" />,
};

function GlassButton({ icon, label, onClick, variant = "" }) {
    return (
        <button type="button" className={`glass-action ${variant}`} onClick={onClick} aria-label={label} title={label}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[icon]}
            </svg>
            <span>{label}</span>
        </button>
    );
}

export default function ActionButtons({ onDecide }) {
    return (
        <div className="deck-actions">
            <GlassButton icon="skip" label="No la he visto" onClick={() => onDecide("skipped")} />
            <GlassButton icon="watch" label="Quiero verla" onClick={() => onDecide("watchlist")} variant="is-watch" />
            <GlassButton icon="rate" label="Ya la vi" onClick={() => onDecide("liked")} variant="is-like" />
        </div>
    );
}
