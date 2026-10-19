import { useState } from "react";
import Sheet from "./Sheet";

/** Elegir tus plataformas: las populares primero y el resto con "Ver todas". */
export default function PlatformsSheet({ catalog, platforms, onToggle, onClose }) {
    const [all, setAll] = useState(false);
    const shown = all ? catalog : catalog.filter((platform) => platform.popular || platforms.includes(platform.key));
    const hidden = catalog.length - shown.length;

    return (
        <Sheet
            onClose={onClose}
            title="Tus plataformas"
            subtitle={platforms.length ? `${platforms.length} marcadas` : "Toca las que tienes"}
            footer={
                <button type="button" className="btn btn-primary btn-wide" onClick={onClose}>
                    Listo
                </button>
            }
        >
            <p className="sheet-meta">Las que marques salen resaltadas en la ficha de cada título, y primero.</p>
            <div className="platform-picker">
                {shown.map((platform) => {
                    const on = platforms.includes(platform.key);
                    return (
                        <button
                            key={platform.key}
                            type="button"
                            className={`provider ${on ? "is-mine" : ""}`}
                            aria-pressed={on}
                            onClick={() => onToggle(platform.key)}
                        >
                            {platform.logo && <img src={platform.logo} alt="" />}
                            {platform.name}
                        </button>
                    );
                })}
                {hidden > 0 && (
                    <button type="button" className="provider is-more" onClick={() => setAll(true)}>
                        Ver todas (+{hidden})
                    </button>
                )}
            </div>
        </Sheet>
    );
}
