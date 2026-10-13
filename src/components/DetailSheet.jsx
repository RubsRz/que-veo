import Sheet from "./Sheet";
import TitleDetails from "./TitleDetails";

/** La ficha de un título en celular: va dentro de la hoja estándar. */
export default function DetailSheet({ item, entry, onClose, onDecide, onForget, friendOpinions = [], onShare = null }) {
    return (
        <Sheet onClose={onClose} title={item.title}>
            <TitleDetails
                item={item}
                entry={entry}
                onDecide={onDecide}
                onForget={onForget}
                friendOpinions={friendOpinions}
                onShare={onShare}
                hideTitle
            />
        </Sheet>
    );
}
