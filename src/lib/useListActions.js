import { useCallback } from "react";

/**
 * Lo que se puede hacer dentro de una lista abierta: la palomita (que pide
 * calificar), votar, quitar con deshacer, salirse con confirmación y el menú de
 * cada título. Vive aparte de App para que App solo arme pantallas y hojas.
 */
export function useListActions({ user, library, social, nav, notify, decide, restore, forget, people, commitDecision, forgetWithUndo }) {
    const sharedById = useCallback((id) => social.lists.find((list) => list.id === id) ?? null, [social.lists]);


    /** La palomita de una lista en conjunto. Marcarla pide calificarla, y la calificación es tuya. */
    function toggleWatched(list, item, mineSeen) {
        if (mineSeen) {
            if (!item.watchedBy?.[user.uid] && !item.watched) {
                const entry = library[item.id];
                notify(`Ya la calificaste${entry?.stars ? ` con ${entry.stars}★` : ""}: cámbiala desde su ficha`);
                return;
            }
            social.markWatched(list.id, item, false).catch(() => notify("No se pudo cambiar"));
            notify("Ya no cuenta como vista", () => social.markWatched(list.id, item, true));
            return;
        }
        nav.open("stars", { item, purpose: "list", listId: list.id });
    }

    /** Ya la vi, desde una lista: palomita y, si hay estrellas, a tu biblioteca. */
    function watchedFromList(listId, item, stars) {
        const list = sharedById(listId);
        if (!list) return;
        const previous = library[item.id] ?? null;
        social.markWatched(listId, item, true).catch(() => notify("No se pudo marcar"));
        if (stars) decide(item, "liked", stars).catch(() => notify("No se pudo guardar"));
        nav.close("stars");

        const everyone = new Set([...(item.seen ?? []), user.uid]).size >= list.members.length;
        const where = everyone ? "Ya la vieron todos" : "Marcada como vista";
        notify(stars ? `${where} · ${stars}★` : where, () => {
            social.markWatched(listId, item, false);
            if (stars) (previous ? restore(previous) : forget(item.id)).catch(() => {});
        });
    }

    function removeFromList(list, item) {
        social.removeFromList(list.id, item).catch(() => notify("No se pudo quitar"));
        notify("Quitada de la lista", () => social.restoreToList(list.id, item));
    }

    function confirmLeave(list) {
        const last = list.members.length <= 1;
        const others = list.members.filter((uid) => uid !== user.uid).map((uid) => people(uid, list).name ?? "alguien");
        const count = (social.listItems[list.id] ?? []).filter((item) => !item.removedAt).length;
        nav.swap("listSettings", "confirm", {
            title: last ? `¿Borrar “${list.name}”?` : `¿Salirte de “${list.name}”?`,
            body: last
                ? `Eres el único en la lista: se borra con sus ${count} ${count === 1 ? "título" : "títulos"} y su link de invitación. No se puede deshacer.`
                : `${others.join(", ")} ${others.length === 1 ? "la conserva" : "la conservan"}. Para volver a entrar, alguien te tiene que invitar.`,
            confirmLabel: last ? "Borrar la lista" : "Salirme",
            onConfirm: () => {
                nav.closeList();
                social
                    .leaveList(list)
                    .then(() => notify(last ? "Lista borrada" : `Te saliste de ${list.name}`))
                    .catch(() => notify("No se pudo, intenta otra vez"));
            },
        });
    }

    /** Lo que se puede hacer con un título de la lista abierta, según dónde esté. */
    function menuActions({ item, scope, listId }, menuId) {
        const toDetail = { label: "Ver ficha", onSelect: () => nav.swap(menuId, "detail", { item }) };

        if (scope === "mine") {
            const entry = library[item.id] ?? item;
            return [
                toDetail,
                {
                    label: entry.stars ? `Cambiar calificación (${entry.stars}★)` : "Ya la vi, calificarla",
                    onSelect: () => nav.swap(menuId, "stars", { item: entry, purpose: "decide" }),
                },
                ...(entry.decision === "skipped"
                    ? [{ label: "Pasarla a Quiero verla", onSelect: () => (nav.close(menuId), commitDecision(entry, "watchlist")) }]
                    : []),
                ...(social.enabled ? [{ label: "Compartir", onSelect: () => nav.swap(menuId, "share", { item: entry }) }] : []),
                { label: "Quitar de mis listas", danger: true, onSelect: () => (nav.close(menuId), forgetWithUndo(entry)) },
            ];
        }

        const list = sharedById(listId);
        if (!list) return [];

        if (scope === "removed") {
            return [
                {
                    label: "Regresarla a la lista",
                    onSelect: () => {
                        nav.close(menuId);
                        social.restoreToList(list.id, item).then(() => notify("Regresó a la lista"));
                    },
                },
                {
                    label: "Borrar para siempre",
                    danger: true,
                    onSelect: () =>
                        nav.swap(menuId, "confirm", {
                            title: `¿Borrar “${item.title}” para siempre?`,
                            body: "Se va de la lista para todos y ya no se puede regresar.",
                            confirmLabel: "Borrar para siempre",
                            onConfirm: () => {
                                nav.close("confirm");
                                social.purgeFromList(list.id, item).catch(() => notify("No se pudo borrar"));
                            },
                        }),
                },
            ];
        }

        const mineSeen = (item.seen ?? []).includes(user.uid);
        const voted = Boolean(item.votes?.[user.uid]);
        return [
            toDetail,
            {
                label: mineSeen ? "Ya no la cuento como vista" : "Ya la vi",
                onSelect: () => {
                    if (mineSeen) nav.close(menuId);
                    else return nav.swap(menuId, "stars", { item, purpose: "list", listId: list.id });
                    toggleWatched(list, item, mineSeen);
                },
            },
            {
                label: voted ? "Quitar mi voto" : "Votar para verla",
                onSelect: () => {
                    nav.close(menuId);
                    social.vote(list.id, item, !voted).catch(() => notify("No se pudo votar"));
                },
            },
            {
                label: "Quitar de la lista para todos",
                danger: true,
                onSelect: () => (nav.close(menuId), removeFromList(list, item)),
            },
        ];
    }

    function listActions(list) {
        const shared = list.kind === "shared";
        return {
            back: nav.closeList,
            openItem: (item) => nav.open("detail", { item }),
            menu: (item) => nav.open("menu", { item, scope: shared ? "shared" : "mine", listId: list.id }),
            removedMenu: (item) => nav.open("menu", { item, scope: "removed", listId: list.id }),
            toggleWatched: (item, mineSeen) => toggleWatched(list, item, mineSeen),
            vote: (item, on) => social.vote(list.id, item, on).catch(() => notify("No se pudo votar")),
            restore: (item) => social.restoreToList(list.id, item).then(() => notify("Regresó a la lista")),
            invite: () => nav.open("invite", { listId: list.id }),
            settings: () => nav.open("listSettings", { listId: list.id }),
            pick: () => nav.open("pick", { listId: list.id }),
        };
    }

    return { sharedById, menuActions, listActions, watchedFromList, confirmLeave };
}
