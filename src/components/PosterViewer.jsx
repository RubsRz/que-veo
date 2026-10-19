import { useLayer } from "../lib/layers";

/** El póster a pantalla completa. Se cierra tocando en cualquier lado. */
export default function PosterViewer({ item, onClose }) {
    useLayer(onClose);
    return (
        <div className="poster-viewer" onClick={onClose}>
            <img src={item.posterHd ?? item.poster} alt={item.title} />
            <p>{item.title}</p>
        </div>
    );
}
