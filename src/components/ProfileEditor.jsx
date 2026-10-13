import { useRef, useState } from "react";
import Avatar from "./Avatar";
import Sheet from "./Sheet";

/**
 * Editar tu perfil: la foto en grande y tu nombre. La foto se cambia desde un
 * menú que sube desde abajo, con las dos únicas opciones que hacen falta.
 */
export default function ProfileEditor({ user, photo, name, username, onSave, onSaveUsername, onPickPhoto, onRemovePhoto, onClose }) {
    const [value, setValue] = useState(name ?? "");
    const [usuario, setUsuario] = useState(username ?? "");
    const [menu, setMenu] = useState(false);
    const input = useRef(null);

    async function guardar() {
        onSave(value.trim());
        if (onSaveUsername && usuario !== username) {
            const problema = await onSaveUsername(usuario);
            if (problema) return; // se queda abierto para que lo corrijas
        }
        onClose();
    }

    return (
        <>
            <Sheet
                onClose={onClose}
                title="Editar perfil"
                footer={
                    <button type="button" className="btn btn-primary btn-wide" onClick={guardar}>
                        Guardar
                    </button>
                }
            >
                <div className="profile-editor">
                    <span className="profile-photo">
                        <Avatar user={{ ...user, displayName: value || user?.displayName }} photo={photo} />
                    </span>
                    <button type="button" className="link-btn" onClick={() => setMenu(true)}>
                        Editar foto
                    </button>

                    <label className="field-label" htmlFor="nombre">
                        Tu nombre
                    </label>
                    <input
                        id="nombre"
                        ref={input}
                        className="field-input"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && guardar()}
                        placeholder="Como quieres que te vean"
                        maxLength={40}
                    />
                    {onSaveUsername && (
                        <>
                            <label className="field-label" htmlFor="usuario" style={{ marginTop: 16 }}>
                                Tu usuario
                            </label>
                            <input
                                id="usuario"
                                className="field-input"
                                value={usuario}
                                onChange={(event) => setUsuario(event.target.value.toLowerCase())}
                                onKeyDown={(event) => event.key === "Enter" && guardar()}
                                placeholder="comotellaman"
                                maxLength={20}
                                autoCapitalize="none"
                                autoCorrect="off"
                            />
                        </>
                    )}
                    <p className="sheet-meta" style={{ marginTop: 8 }}>
                        Así te ven y te buscan tus amigos.
                    </p>
                </div>
            </Sheet>

            {menu && (
                <div className="action-menu" onPointerDown={(event) => event.target === event.currentTarget && setMenu(false)}>
                    <div className="action-menu-card" role="dialog" aria-label="Foto de perfil">
                        <button
                            type="button"
                            onClick={() => {
                                setMenu(false);
                                onPickPhoto();
                            }}
                        >
                            Elegir de la galería
                        </button>
                        {photo && (
                            <button
                                type="button"
                                className="is-danger"
                                onClick={() => {
                                    setMenu(false);
                                    onRemovePhoto();
                                }}
                            >
                                Eliminar foto
                            </button>
                        )}
                        <button type="button" className="is-cancel" onClick={() => setMenu(false)}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
