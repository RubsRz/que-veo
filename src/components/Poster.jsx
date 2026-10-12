/** Póster con título y, si la calificaste, sus estrellas. */
export default function Poster({ item, onClick }) {
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
        </button>
    );
}
