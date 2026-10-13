import { useState } from "react";
import Sheet from "./Sheet";
import Stars from "./Stars";
import { ratingInfo } from "../lib/ratings";

/** Al marcar "ya la vi" se pide la calificación, y siempre se confirma. */
export default function StarsPrompt({ item, entry, onSave, onCancel }) {
    const [stars, setStars] = useState(entry?.stars ?? 0);
    const info = ratingInfo(stars);

    return (
        <Sheet
            onClose={onCancel}
            title="¿Qué tal estuvo?"
            subtitle={item.title}
            footer={
                <button type="button" className="btn btn-primary btn-wide" disabled={!stars} onClick={() => onSave(stars)}>
                    {stars ? `Guardar ${stars}★` : "Elige una calificación"}
                </button>
            }
        >
            <div className="stars-prompt">
                <Stars value={stars} size={42} label="¿Cuántas estrellas?" onDraft={setStars} />

                <p className="stars-score">{stars ? `${stars}★` : "—"}</p>
                {info ? (
                    <>
                        <p className="stars-title">
                            {info.title} <span>· {info.group}</span>
                        </p>
                        <p className="stars-label">{info.hint}</p>
                    </>
                ) : (
                    <p className="stars-label">Toca una estrella o arrastra el dedo para afinar</p>
                )}
            </div>
        </Sheet>
    );
}
