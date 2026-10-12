/** Póster con título y, si la calificaste, sus estrellas. `note` es para lo de tus amigos. */
export default function Poster({ item, onClick, note = null }) {
    return (
        <button type="button" className="poster" onClick={onClick} title={item.title}>
            {item.poster ? (
                <img src={item.poster} alt="" loading="lazy" />
            ) : (
                <span className="poster-empty">{item.title}</span>
            )}
            {item.stars ? <span className="poster-stars">★ {item.stars}</span> : null}
            <span className="poster-caption">
                {item.title}
                {item.year ? ` · ${item.year}` : ""}
            </span>
            {note && <span className="poster-note">{note}</span>}
        </button>
    );
}
