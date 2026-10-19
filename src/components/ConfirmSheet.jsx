import { useState } from "react";
import Sheet from "./Sheet";

/**
 * Para lo que no tiene vuelta atrás o les afecta a otros. Dice exactamente qué va
 * a pasar y el botón repite la acción, nada de "Aceptar" a secas.
 */
export default function ConfirmSheet({ title, body, confirmLabel, danger = true, cancelLabel = "Cancelar", onConfirm, onClose }) {
    const [busy, setBusy] = useState(false);

    async function confirmar() {
        setBusy(true);
        try {
            await onConfirm();
        } finally {
            setBusy(false);
        }
    }

    return (
        <Sheet
            onClose={onClose}
            title={title}
            footer={
                <div className="confirm-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
                        {cancelLabel}
                    </button>
                    <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={confirmar} disabled={busy}>
                        {busy ? "Un momento…" : confirmLabel}
                    </button>
                </div>
            }
        >
            <p className="confirm-body">{body}</p>
        </Sheet>
    );
}
