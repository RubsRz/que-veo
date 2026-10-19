import { useCallback, useEffect, useRef, useState } from "react";

const MINE = ["liked", "watchlist", "disliked", "skipped"];

/** Lo que trae el link con el que se abrió la app, antes de limpiarlo. */
const readInitial = () => {
    const params = new URLSearchParams(location.search);
    return {
        lista: params.get("lista"),
        titulo: params.get("t"),
        usuario: params.get("u"),
        invitacion: params.get("l"),
    };
};

export const listFromParam = (value) => (value ? { kind: MINE.includes(value) ? "mine" : "shared", id: value } : null);

/** La URL que le toca a lo que estás viendo: la lista abierta y la ficha, si hay. */
const urlFor = (list, overlays) => {
    const params = new URLSearchParams();
    if (list) params.set("lista", list.id);
    const detail = overlays.findLast((overlay) => overlay.kind === "detail");
    if (detail) params.set("t", detail.props.item.id);
    const query = params.toString();
    return location.pathname + (query ? `?${query}` : "");
};

let nextId = 0;

/**
 * Qué está abierto encima de las pestañas: la lista a pantalla completa y una pila
 * de hojas. Todo pasa por el historial del navegador, así que el "atrás" de
 * Android (o del navegador) cierra la hoja de arriba en vez de sacarte de la app,
 * y una lista o una ficha tienen su propio link.
 *
 * En `history.state` solo va lo que se puede guardar: la lista y cuántas hojas
 * hay. Las hojas en sí (con sus funciones) viven aquí en memoria.
 */
export function useNavigation() {
    const [initial] = useState(readInitial);
    const [listView, setListView] = useState(null);
    const [overlays, setOverlays] = useState([]);
    // Copia síncrona: los cierres llaman a history.go y el popstate llega después
    const current = useRef({ listView: null, overlays: [] });

    const commit = (list, stack) => {
        current.current = { listView: list, overlays: stack };
        setListView(list);
        setOverlays(stack);
    };

    const started = useRef(false);

    useEffect(() => {
        // El link de entrada ya se leyó: se deja la URL limpia como punto de partida.
        // Una sola vez (StrictMode monta dos veces y borraría lo que ya se abrió).
        if (!started.current) history.replaceState({ list: null, depth: 0 }, "", location.pathname);
        started.current = true;

        const onPop = (event) => {
            const state = event.state ?? { list: null, depth: 0 };
            const stack = current.current.overlays.slice(0, state.depth ?? 0);
            commit(state.list ?? null, stack);
            // Si se cerró una hoja de en medio, la URL de esta entrada ya no aplica
            history.replaceState(state, "", urlFor(state.list ?? null, stack));
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    /**
     * Abre una lista a pantalla completa. Si se abre desde una hoja (al crearla o
     * al aceptar un link), la hoja se cambia por la lista en vez de apilarse.
     */
    const openList = useCallback((list) => {
        const view = { kind: list.kind, id: list.id };
        const { overlays: stack } = current.current;
        if (stack.length) history.replaceState({ list: view, depth: 0 }, "", urlFor(view, []));
        else history.pushState({ list: view, depth: 0 }, "", urlFor(view, []));
        commit(view, []);
    }, []);

    /** Abre una hoja encima de lo que haya. Devuelve su id, por si hay que cerrarla. */
    const open = useCallback((kind, props = {}) => {
        const { listView: list, overlays: stack } = current.current;
        const id = (nextId += 1);
        const next = [...stack, { id, kind, props }];
        history.pushState({ list, depth: next.length }, "", urlFor(list, next));
        commit(list, next);
        return id;
    }, []);

    /**
     * Cambia una hoja por otra sin moverse en el historial: del menú de un título
     * a su ficha, por ejemplo. Si la hoja ya no está, abre la nueva y ya.
     */
    const swap = useCallback(
        (which, kind, props = {}) => {
            const { listView: list, overlays: stack } = current.current;
            const index = stack.findIndex((overlay) => overlay.id === which || overlay.kind === which);
            if (index === -1) return open(kind, props);
            const id = (nextId += 1);
            const next = stack.map((overlay, position) => (position === index ? { id, kind, props } : overlay));
            history.replaceState({ list, depth: next.length }, "", urlFor(list, next));
            commit(list, next);
            return id;
        },
        [open],
    );

    /**
     * Cierra hojas. Sin argumento, la de arriba; con un tipo, un id o una lista de
     * ellos, esas. Se quitan de una vez y luego se regresa el historial lo mismo
     * que se quitó (un solo `history.go`, para que no se encimen dos regresos).
     */
    const close = useCallback((which) => {
        const { listView: list, overlays: stack } = current.current;
        if (!stack.length) return;
        const wanted = [which].flat();
        const matches =
            which === undefined
                ? (overlay) => overlay === stack[stack.length - 1]
                : (overlay) => wanted.includes(overlay.kind) || wanted.includes(overlay.id);
        const rest = stack.filter((overlay) => !matches(overlay));
        const removed = stack.length - rest.length;
        if (!removed) return;
        commit(list, rest);
        history.go(-removed);
    }, []);

    /** Regresar de la lista abierta (como el botón ‹). */
    const closeList = useCallback(() => {
        const { listView: list, overlays: stack } = current.current;
        if (!list) return;
        commit(null, []);
        history.go(-(1 + stack.length));
    }, []);

    /** Al cambiar de pestaña se cierra todo y el historial vuelve al inicio. */
    const reset = useCallback(() => {
        const { listView: list, overlays: stack } = current.current;
        const steps = stack.length + (list ? 1 : 0);
        if (!steps) return;
        commit(null, []);
        history.go(-steps);
    }, []);

    return { initial, listView, overlays, openList, closeList, open, swap, close, reset };
}
