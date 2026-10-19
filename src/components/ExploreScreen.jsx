import SwipeCard from "./SwipeCard";
import ActionButtons from "./ActionButtons";
import DetailPanel from "./DetailPanel";
import { friendsBadge } from "../lib/social";

/** La baraja: películas o series, una tarjeta a la vez, y en escritorio la ficha al lado. */
export default function ExploreScreen({
    deckType,
    onDeckType,
    taste,
    deck,
    genres,
    ratings,
    library,
    isDesktop,
    onDecide,
    onOpen,
    onPoster,
    onFriends,
    onForget,
    friendOpinions,
    onShare,
    myPlatforms,
    onPickPlatforms,
}) {
    const { deck: cards, loading, error, retry, searchMore } = deck;
    const current = cards[0];

    return (
        <main className="screen is-deck">
            <div className="deck-head">
                <div className="segmented">
                    <button type="button" className={deckType === "movie" ? "is-active" : ""} onClick={() => onDeckType("movie")}>
                        Películas
                    </button>
                    <button type="button" className={deckType === "tv" ? "is-active" : ""} onClick={() => onDeckType("tv")}>
                        Series
                    </button>
                </div>
                <span className="action-hint deck-count">
                    {taste.ready ? `${taste.rated} calificadas` : `Calibrando · ${taste.rated}/5`}
                </span>
            </div>

            <div className="deck-layout">
                <div className="deck-col">
                    <div className="deck">
                        {error && (
                            <div className="empty">
                                <b>No se pudo cargar el catálogo</b>
                                <p>{error}</p>
                                <button type="button" className="btn btn-primary" onClick={retry}>
                                    Reintentar
                                </button>
                            </div>
                        )}
                        {!error && !current && loading && (
                            <div className="card card-skeleton" aria-label="Cargando títulos">
                                <span className="shine" />
                            </div>
                        )}
                        {!error && !current && !loading && (
                            <div className="empty">
                                <b>Ya no hay más por ahora</b>
                                <p>Ya calificaste casi todo lo que había. Busca más o revisa tus listas.</p>
                                <button type="button" className="btn btn-primary" onClick={searchMore}>
                                    Buscar más títulos
                                </button>
                            </div>
                        )}

                        {/* Solo se montan dos tarjetas: la de arriba y la que asoma debajo */}
                        {cards.slice(0, 2).reverse().map((item, index, array) => {
                            const isTop = index === array.length - 1;
                            return isTop ? (
                                <SwipeCard
                                    key={item.id}
                                    item={item}
                                    genreNames={genres}
                                    friends={friendsBadge(ratings[item.id])}
                                    onDecide={(decision) => onDecide(item, decision)}
                                    // En escritorio la ficha ya está fija a la derecha, así que
                                    // un clic en la tarjeta muestra el póster en grande
                                    onOpen={() => (isDesktop ? onPoster(item) : onOpen(item))}
                                    onPoster={() => onPoster(item)}
                                    onFriends={() => onFriends(item)}
                                />
                            ) : (
                                <article key={item.id} className="card" style={{ transform: "scale(0.96) translateY(10px)", opacity: 0.75 }}>
                                    {item.poster ? <img className="card-poster" src={item.poster} alt="" /> : <div className="card-fallback" />}
                                </article>
                            );
                        })}
                    </div>

                    {current && <ActionButtons onDecide={(decision) => onDecide(current, decision)} />}
                </div>

                {isDesktop && (
                    <DetailPanel
                        item={current}
                        entry={current ? library[current.id] : null}
                        onDecide={onDecide}
                        onForget={onForget}
                        friendOpinions={friendOpinions(current)}
                        onShare={onShare}
                        myPlatforms={myPlatforms}
                        onPickPlatforms={onPickPlatforms}
                    />
                )}
            </div>
            {isDesktop && current && (
                <p className="keys-hint">
                    Atajos: <kbd>→</kbd> ya la vi · <kbd>↑</kbd> quiero verla · <kbd>←</kbd> no la he visto · <kbd>⌘Z</kbd> deshacer
                </p>
            )}
        </main>
    );
}
