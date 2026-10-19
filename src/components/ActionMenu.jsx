import { useLayer } from "../lib/layers";

/**
 * El menú que sube desde abajo, como el de iOS: un título y sus acciones. Lo
 * destructivo va en rojo y separado de lo demás, nunca junto a lo que se usa diario.
 */
export default function ActionMenu({ title, subtitle, actions, onClose }) {
    useLayer(onClose);
    const normal = actions.filter((action) => !action.danger);
    const danger = actions.filter((action) => action.danger);

    return (
        <div className="action-menu" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
            <div className="action-menu-card" role="dialog" aria-modal="true" aria-label={title}>
                {title && (
                    <p className="action-menu-head">
                        <b>{title}</b>
                        {subtitle && <small>{subtitle}</small>}
                    </p>
                )}
                {normal.map((action) => (
                    <button key={action.label} type="button" disabled={action.disabled} onClick={action.onSelect}>
                        {action.label}
                    </button>
                ))}
                {danger.map((action) => (
                    <button key={action.label} type="button" className="is-danger" onClick={action.onSelect}>
                        {action.label}
                    </button>
                ))}
                <button type="button" className="is-cancel" onClick={onClose}>
                    Cancelar
                </button>
            </div>
        </div>
    );
}
