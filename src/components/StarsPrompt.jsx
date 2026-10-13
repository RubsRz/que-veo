import { useState } from "react";
import Sheet from "./Sheet";
import Stars from "./Stars";

/** Al marcar "me gustó" se pide la calificación antes de guardar. */
export default function StarsPrompt({ item, onSave, onCancel }) {
    const [stars, setStars] = useState(0);
    const LABELS = ["", "No tanto", "Pasable", "Buena", "Muy buena", "De mis favoritas"];
    const label = stars ? LABELS[Math.ceil(stars)] : "Toca una estrella · la mitad izquierda da media";

    return (
        <Sheet onClose={onCancel} title="¿Qué tal estuvo?" subtitle={item.title}>
            <div className="stars-prompt">

                <Stars
                    value={stars}
                    size={42}
                    label="¿Cuántas estrellas?"
                    onChange={(value) => {
                        setStars(value);
                        onSave(value);
                    }}
                />
                <p className="stars-label">
                    {label}
                    {stars ? ` · ${stars}★` : ""}
                </p>

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
