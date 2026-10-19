import Avatar from "./Avatar";
import { hasApiKey } from "../lib/tmdb";

/** Tu perfil: la cuenta, tus plataformas, tus números y tus géneros. */
export default function ProfileScreen({ user, cloudEnabled, displayName, photo, stats, platformCatalog = [], platforms = [], onEditPlatforms, onEdit, onLogin, onLogout }) {
    // Solo los íconos de las tuyas; para elegir se abre la hoja con todas
    const mine = platformCatalog.filter((platform) => platforms.includes(platform.key));
    return (
        <main className="screen">
            <div className="profile-card">
                <div className="profile-top">
                    <Avatar user={{ ...user, displayName }} photo={photo} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <b>{displayName ?? "Sin cuenta"}</b>
                        <p className="sheet-meta">
                            {user ? "Tus listas se sincronizan" : cloudEnabled ? "Tus listas viven solo en este navegador" : "Modo local"}
                        </p>
                    </div>
                    <button type="button" className="icon-btn" onClick={onEdit} aria-label="Editar perfil" title="Editar perfil">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17z" />
                        </svg>
                    </button>
                </div>
                {cloudEnabled ? (
                    user ? (
                        <button type="button" className="btn btn-ghost" onClick={onLogout}>
                            Cerrar sesión
                        </button>
                    ) : (
                        <button type="button" className="btn btn-primary" onClick={onLogin}>
                            Entrar con Google
                        </button>
                    )
                ) : (
                    <p className="notice">
                        Falta configurar Firebase: agrega las variables <b>VITE_FIREBASE_*</b> en tu archivo <b>.env</b> para
                        sincronizar tus listas entre dispositivos.
                    </p>
                )}
            </div>

            {platformCatalog.length > 0 && (
                <section>
                    <div className="section-head">
                        <h2 className="section-title">Tus plataformas</h2>
                        <button type="button" className="btn btn-ghost btn-small" onClick={onEditPlatforms}>
                            {mine.length ? "Editar" : "Elegir"}
                        </button>
                    </div>
                    {mine.length === 0 ? (
                        <p className="notice">Marca las que tienes y saldrán resaltadas en la ficha de cada título.</p>
                    ) : (
                        <button type="button" className="platform-icons" onClick={onEditPlatforms} aria-label={`Tus plataformas: ${mine.map((platform) => platform.name).join(", ")}`}>
                            {mine.slice(0, 5).map((platform) =>
                                platform.logo ? (
                                    <img key={platform.key} src={platform.logo} alt="" title={platform.name} />
                                ) : (
                                    <span key={platform.key} className="platform-icon-text" title={platform.name}>
                                        {platform.name.slice(0, 2)}
                                    </span>
                                ),
                            )}
                            {mine.length > 5 && <span className="platform-icon-text">+{mine.length - 5}</span>}
                        </button>
                    )}
                </section>
            )}

            <h2 className="section-title">Tus números</h2>
            <dl className="stats-grid">
                <div>
                    <dt>Vistas</dt>
                    <dd>{stats.liked + stats.disliked}</dd>
                </div>
                <div>
                    <dt>Pendientes</dt>
                    <dd>{stats.watchlist}</dd>
                </div>
                <div>
                    <dt>Horas</dt>
                    <dd>{stats.hours}</dd>
                </div>
                <div>
                    <dt>Promedio</dt>
                    <dd>{stats.averageStars ? `★ ${stats.averageStars}` : "—"}</dd>
                </div>
            </dl>

            <h2 className="section-title">Tus géneros</h2>
            {stats.topGenres.length === 0 ? (
                <p className="notice">Califica unas cuantas y aquí vas a ver qué te late de verdad.</p>
            ) : (
                <div className="bars">
                    {stats.topGenres.map((genre) => (
                        <div key={genre.id} className="bar-row">
                            <span>{genre.name}</span>
                            <span className="bar">
                                <i style={{ width: `${Math.round(genre.score * 100)}%` }} />
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {!hasApiKey && (
                <p className="notice" style={{ marginTop: 16 }}>
                    <b>Modo demo:</b> estás viendo unos cuantos títulos de ejemplo. Agrega tu llave <b>VITE_TMDB_KEY</b> en{" "}
                    <b>.env</b> para usar el catálogo completo de TMDB.
                </p>
            )}
            <p className="notice">
                Datos de películas y series por <b>TMDB</b>. Dónde verlas, por <b>JustWatch</b>.
            </p>
        </main>
    );
}
