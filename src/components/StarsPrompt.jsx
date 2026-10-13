import { useState } from "react";
import Sheet from "./Sheet";
import Stars from "./Stars";

/** Al marcar "me gustó" se pide la calificación antes de guardar. */
export default function StarsPrompt({ item, onSave, onCancel }) {
    const [stars, setStars] = useState(0);
    const LABELS = ["", "No tanto", "Pasable", "Buena", "Muy buena", "De mis favoritas"];
    const label = stars ? LABELS[Math.ceil(stars)] : "Toca una estrella, o arrastra para afinar";

    return (
        <Sheet onClose={onCancel} title="¿Qué tal estuvo?" subtitle={item.title}>
            <div className="stars-prompt">

                <Stars
                    value={stars}
                    size={42}
                    label="¿Cuántas estrellas?"
                    onDraft={setStars}
                    onChange={(value) => {
                        setStars(value);
                        onSave(value);
                    }}
                />
                <p className="stars-score">{stars ? `${stars}★` : "—"}</p>
                <p className="stars-label">{label}</p>

                <div className="sheet-actions">
                    {stars > 0 && (
                        <button type="button" className="btn btn-primary btn-wide" onClick={() => onSave(stars)}>
                            Guardar {stars}★
                        </button>
                    )}
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
