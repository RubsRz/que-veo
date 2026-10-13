/**
 * Estrellas de media en media: cada estrella tiene dos mitades, así que se puede
 * dar 4.5. La parte dorada se recorta por porcentaje, por eso una media estrella
 * se ve exactamente a la mitad.
 */
const STAR = "M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z";

function One({ fill, size }) {
    return (
        <span className="star" style={{ width: size, height: size }}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={STAR} className="star-bg" />
            </svg>
            <span className="star-fill" style={{ width: `${fill * 100}%` }}>
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size }}>
                    <path d={STAR} />
                </svg>
            </span>
        </span>
    );
}

export default function Stars({ value = 0, onChange = null, size = 34, label = "Calificación" }) {
    const stars = [1, 2, 3, 4, 5];

    if (!onChange) {
        return (
            <span className="stars-view" role="img" aria-label={`${value} de 5 estrellas`}>
                {stars.map((index) => (
                    <One key={index} fill={Math.min(1, Math.max(0, value - index + 1))} size={size} />
                ))}
            </span>
        );
    }

    return (
        <div className="stars" role="group" aria-label={label}>
            {stars.map((index) => (
                <span key={index} className="star-slot">
                    <One fill={Math.min(1, Math.max(0, value - index + 1))} size={size} />
                    {/* Dos zonas: la izquierda da media estrella y la derecha la entera */}
                    <button
                        type="button"
                        className="star-hit is-half"
                        onClick={() => onChange(index - 0.5)}
                        aria-label={`${index - 0.5} estrellas`}
                    />
                    <button
                        type="button"
                        className="star-hit is-full"
                        onClick={() => onChange(index)}
                        aria-label={`${index} estrellas`}
                    />
                </span>
            ))}
        </div>
    );
}
