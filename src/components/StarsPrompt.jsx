import { useState } from "react";
import Sheet from "./Sheet";

/** Al marcar "me gustó" se pide la calificación antes de guardar. */
export default function StarsPrompt({ item, onSave, onCancel }) {
    const [hover, setHover] = useState(0);
    const LABELS = ["", "No tanto", "Pasable", "Buena", "Muy buena", "De mis favoritas"];

    return (
        <Sheet onClose={onCancel} title="¿Qué tal estuvo?" subtitle={item.title}>
            <div className="stars-prompt">

                <div className="stars stars-big">
                    {[1, 2, 3, 4, 5].map((value) => (
                        <button
                            key={value}
                            type="button"
                            className={value <= hover ? "is-on" : ""}
                            onMouseEnter={() => setHover(value)}
                            onFocus={() => setHover(value)}
                            onClick={() => onSave(value)}
                            aria-label={`${value} estrellas`}
                        >
                            ★
                        </button>
                    ))}
                </div>
                <p className="stars-label">{LABELS[hover] || "Toca una estrella"}</p>

                <div className="sheet-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => onSave(null)}>
                        Guardar sin calificar
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={onCancel}>
                        Cancelar
                    </button>
                </div>
            </div>
        </Sheet>
    );
}
