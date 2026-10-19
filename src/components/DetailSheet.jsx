import Sheet from "./Sheet";
import TitleDetails from "./TitleDetails";

/** La ficha de un título en celular: va dentro de la hoja estándar. */
export default function DetailSheet({ item, entry, onClose, onDecide, onForget, friendOpinions = [], onShare = null, myPlatforms = [], onPickPlatforms = null }) {
    return (
        <Sheet onClose={onClose} title={item.title || "Ficha"}>
            <TitleDetails
                item={item}
                entry={entry}
                onDecide={onDecide}
                onForget={onForget}
                friendOpinions={friendOpinions}
                onShare={onShare}
                myPlatforms={myPlatforms}
                onPickPlatforms={onPickPlatforms}
                // Al abrir un link a una ficha, el título llega después, con los detalles
                hideTitle={Boolean(item.title)}
            />
        </Sheet>
    );
}
