import Avatar from "./Avatar";
import Sheet from "./Sheet";

const label = (opinion) => {
    if (opinion.decision === "watchlist") return "quiere verla";
    if (!opinion.stars) return "ya la vio";
    return opinion.stars >= 3 ? "le gustó" : "no le latió";
};

/** A quiénes de tus amigos les gustó este título, al tocar la burbuja del póster. */
export default function WhoLikedSheet({ item, opinions, onClose, onOpenFriend }) {
    return (
        <Sheet onClose={onClose} title="Qué dicen tus amigos" subtitle={item.title}>
            <ul className="friend-opinions">
                {opinions.map((opinion) => (
                    <li key={opinion.uid} className={`is-${opinion.decision}`}>
                        <Avatar user={{ displayName: opinion.name }} photo={opinion.photo} />
                        <span>
                            <b>{opinion.name}</b> {label(opinion)}
                        </span>
                        {opinion.stars ? <em>{opinion.stars}★</em> : null}
                    </li>
                ))}
            </ul>
        </Sheet>
    );
}
