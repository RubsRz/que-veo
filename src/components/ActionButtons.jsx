/**
 * Botones de la baraja: iconos de línea sobre vidrio esmerilado, sin emojis.
 * Discretos para que el póster siga siendo el protagonista.
 */
const ICONS = {
    skip: (
        <path d="M6 6l12 12M18 6L6 18" />
    ),
    dislike: (
        <path d="M17 14V4m0 10l-3.2 5.3a1.5 1.5 0 01-2.7-1.2l.9-3.1H7a2 2 0 01-2-2.4l1.2-5A2 2 0 018.2 4H17" />
    ),
    watch: (
        <>
            <circle cx="12" cy="12" r="8.2" />
            <path d="M12 7.5V12l3 1.8" />
        </>
    ),
    like: (
        <path d="M7 10v10m0-10l3.2-5.3a1.5 1.5 0 012.7 1.2L12 9h4.1a2 2 0 011.95 2.45l-1.2 5A2 2 0 0114.9 18H7" />
    ),
};

function GlassButton({ icon, label, onClick, variant = "" }) {
    return (
        <button type="button" className={`glass-action ${variant}`} onClick={onClick} aria-label={label} title={label}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[icon]}
            </svg>
        </button>
    );
}

export default function ActionButtons({ onDecide }) {
    return (
        <div className="deck-actions">
            <GlassButton icon="skip" label="No me interesa" onClick={() => onDecide("skipped")} />
            <GlassButton icon="dislike" label="La vi y no me gustó" onClick={() => onDecide("disliked")} />
            <GlassButton icon="watch" label="Pendiente por ver" onClick={() => onDecide("watchlist")} variant="is-watch" />
            <GlassButton icon="like" label="La vi y me gustó" onClick={() => onDecide("liked")} variant="is-like" />
        </div>
    );
}
