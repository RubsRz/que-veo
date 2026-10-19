import { useCallback, useEffect, useMemo, useState } from "react";
import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import { cloudEnabled, db } from "./firebase";
import { DEFAULT_LOOK } from "./listLook";
import { friendshipId, normalizeUsername, ratingsByItem, suggestUsername, toSharedItem, usernameError } from "./social";

/** Lo que de verdad importa compartir: lo descartado no sale de tu cuenta. */
const SHARED_DECISIONS = ["liked", "disliked", "watchlist"];

const profileOf = (user, photo, name) => ({
    name: name ?? user.displayName ?? "Alguien",
    photo: photo ?? user.photoURL ?? null,
});

/** Mi perfil público y mi código para compartir; se crean la primera vez. */
/** Aparta un usuario para ti. Devuelve false si ya estaba ocupado. */
async function claimUsername(username, uid) {
    try {
        // Escribir sobre uno que ya existe cuenta como update, y eso lo cierran las reglas
        await setDoc(doc(db, "codes", username), { uid, username });
        return true;
    } catch {
        return false;
    }
}

async function ensureProfile(user, photo, name) {
    const reference = doc(db, "profiles", user.uid);
    const existing = await getDoc(reference);

    if (existing.exists() && existing.data().username) {
        // Primero lo que tú pusiste en tu perfil, luego lo que ya estaba guardado
        // y hasta el final lo de Google. Si no, tu foto propia nunca llegaba aquí.
        const saved = existing.data();
        const data = {
            name: name ?? saved.name ?? user.displayName ?? "Alguien",
            photo: photo ?? saved.photo ?? user.photoURL ?? null,
            username: saved.username,
        };
        await setDoc(reference, data, { merge: true });
        return data;
    }

    // Primera vez (o cuenta vieja, que solo tenía código): se le propone el
    // usuario a partir del correo y se le van pegando números si está ocupado
    const base = suggestUsername(user.email ?? user.displayName ?? "");
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const username = attempt === 0 ? base : `${base.slice(0, 17)}${Math.floor(Math.random() * 900) + 100}`;
        if (await claimUsername(username, user.uid)) {
            const data = { ...profileOf(user, photo, name), username };
            await setDoc(reference, data, { merge: true });
            return data;
        }
    }
    throw new Error("No se pudo crear tu usuario");
}

/**
 * Tus amigos: solicitudes, calificaciones de cada quien, recomendaciones y
 * listas en conjunto. Sin sesión no hay nada de esto y la pantalla lo dice.
 */
export function useFriends(user, photo, name) {
    const [profile, setProfile] = useState(null);
    const [blocked, setBlocked] = useState(false); // faltan las reglas de Firestore
    const [links, setLinks] = useState([]); // amistades, aceptadas y pendientes
    const [libraries, setLibraries] = useState({}); // calificaciones de cada amigo
    const [recs, setRecs] = useState([]);
    // Los perfiles en vivo de toda la gente que aparece contigo: si alguien cambia
    // su foto o su nombre, se ve al instante en vez de la copia vieja
    const [profiles, setProfiles] = useState({});
    const [lists, setLists] = useState([]);
    const [listsReady, setListsReady] = useState(false);
    const [listItems, setListItems] = useState({}); // títulos de cada lista en conjunto
    const enabled = Boolean(cloudEnabled && user);

    useEffect(() => {
        if (!enabled) {
            setProfile(null);
            setLinks([]);
            setLibraries({});
            setRecs([]);
            setLists([]);
            setListItems({});
            setListsReady(false);
            return;
        }
        ensureProfile(user, photo, name)
            .then((data) => {
                setProfile(data);
                setBlocked(false);
            })
            .catch(() => {
                setProfile(null);
                setBlocked(true);
            });
    }, [enabled, user, photo, name]);

    // Amistades donde aparezco
    useEffect(() => {
        if (!enabled) return;
        const q = query(collection(db, "friendships"), where("members", "array-contains", user.uid));
        return onSnapshot(q, (snapshot) => {
            setLinks(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        });
    }, [enabled, user]);

    const friends = useMemo(() => {
        if (!user) return [];
        return links
            .filter((link) => link.status === "accepted")
            .map((link) => toFriend(link, user.uid, profiles))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [links, user, profiles]);

    /** Invitaciones que me mandaron y todavía no contesto. */
    const requests = useMemo(() => {
        if (!user) return [];
        return links
            .filter((link) => link.status === "pending" && link.requestedBy !== user.uid)
            .map((link) => toFriend(link, user.uid, profiles));
    }, [links, user, profiles]);

    /** Las que mandé yo y siguen sin respuesta. */
    const sent = useMemo(() => {
        if (!user) return [];
        return links
            .filter((link) => link.status === "pending" && link.requestedBy === user.uid)
            .map((link) => toFriend(link, user.uid, profiles));
    }, [links, user, profiles]);

    // Las calificaciones de cada amigo, en vivo
    const friendIds = friends.map((friend) => friend.uid).join(",");
    useEffect(() => {
        if (!enabled || !friendIds) {
            setLibraries({});
            return;
        }
        const unsubscribes = friendIds.split(",").map((uid) => {
            const q = query(collection(db, "users", uid, "items"), where("decision", "in", SHARED_DECISIONS));
            return onSnapshot(
                q,
                (snapshot) => {
                    const library = {};
                    snapshot.forEach((document) => (library[document.id] = document.data()));
                    setLibraries((current) => ({ ...current, [uid]: library }));
                },
                () => setLibraries((current) => ({ ...current, [uid]: {} })),
            );
        });
        return () => unsubscribes.forEach((stop) => stop());
    }, [enabled, friendIds]);

    // Lo que me recomendaron
    useEffect(() => {
        if (!enabled) return;
        return onSnapshot(collection(db, "users", user.uid, "recs"), (snapshot) => {
            setRecs(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        });
    }, [enabled, user]);

    // Listas en conjunto donde estoy
    useEffect(() => {
        if (!enabled) return;
        const q = query(collection(db, "lists"), where("members", "array-contains", user.uid));
        return onSnapshot(q, (snapshot) => {
            setLists(
                snapshot.docs
                    .map((document) => ({ id: document.id, ...document.data() }))
                    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
            );
            setListsReady(true);
        });
    }, [enabled, user]);

    // Los títulos de cada lista, en vivo: el índice muestra cuántas faltan y la
    // hoja de compartir sabe si un título ya estaba. Es un listener por lista.
    const listIds = lists.map((list) => list.id).join(",");
    useEffect(() => {
        if (!enabled || !listIds) {
            setListItems({});
            return;
        }
        const unsubscribes = listIds.split(",").map((listId) =>
            onSnapshot(
                collection(db, "lists", listId, "items"),
                (snapshot) => {
                    const items = snapshot.docs.map((document) => ({ ...document.data(), id: document.id }));
                    setListItems((current) => ({ ...current, [listId]: items }));
                },
                () => setListItems((current) => ({ ...current, [listId]: [] })),
            ),
        );
        return () => unsubscribes.forEach((stop) => stop());
    }, [enabled, listIds]);

    const peopleIds = useMemo(() => {
        const ids = new Set(user ? [user.uid] : []);
        links.forEach((link) => link.members.forEach((member) => ids.add(member)));
        lists.forEach((list) => (list.members ?? []).forEach((member) => ids.add(member)));
        return [...ids].sort().join(",");
    }, [links, lists, user]);

    useEffect(() => {
        if (!enabled || !peopleIds) return;
        const unsubscribes = peopleIds.split(",").map((uid) =>
            onSnapshot(
                doc(db, "profiles", uid),
                (snapshot) => {
                    const data = snapshot.data();
                    if (data) setProfiles((current) => ({ ...current, [uid]: { name: data.name, photo: data.photo ?? null } }));
                },
                () => {},
            ),
        );
        return () => unsubscribes.forEach((stop) => stop());
    }, [enabled, peopleIds]);

    const ratings = useMemo(() => ratingsByItem(libraries, friends), [libraries, friends]);

    /** Buscar a alguien por su usuario. */
    const lookup = useCallback(async (rawUsername) => {
        const username = normalizeUsername(rawUsername);
        const found = await getDoc(doc(db, "codes", username));
        if (!found.exists()) return null;
        const uid = found.data().uid;
        const theirProfile = await getDoc(doc(db, "profiles", uid));
        return { uid, username, ...(theirProfile.data() ?? {}) };
    }, []);

    /** Mandar invitación al usuario que te pasaron. */
    const invite = useCallback(
        async (rawUsername) => {
            const username = normalizeUsername(rawUsername);
            if (!profile) throw new Error("Primero entra con tu cuenta");
            if (username === profile.username) throw new Error("Ese eres tú");

            const found = await getDoc(doc(db, "codes", username));
            if (!found.exists()) throw new Error(`No encontré a nadie con el usuario @${username}`);

            const other = found.data().uid;
            const theirProfile = await getDoc(doc(db, "profiles", other));
            const pair = friendshipId(user.uid, other);

            const already = await getDoc(doc(db, "friendships", pair));
            if (already.exists()) {
                throw new Error(
                    already.data().status === "accepted" ? "Ya son amigos" : "Ya hay una invitación en camino",
                );
            }

            await setDoc(doc(db, "friendships", pair), {
                members: [user.uid, other].sort(),
                status: "pending",
                requestedBy: user.uid,
                profiles: {
                    [user.uid]: { name: profile.name, photo: profile.photo ?? null },
                    [other]: {
                        name: theirProfile.data()?.name ?? "Alguien",
                        photo: theirProfile.data()?.photo ?? null,
                    },
                },
                createdAt: serverTimestamp(),
            });

            return theirProfile.data()?.name ?? "tu amigo";
        },
        [profile, user],
    );

    /** Para que tus amigos vean tu nombre y tu foto nuevos. */
    const publishProfile = useCallback(
        (fields) => (enabled ? setDoc(doc(db, "profiles", user.uid), fields, { merge: true }) : Promise.resolve()),
        [enabled, user],
    );

    /** Cambiar tu usuario: se aparta el nuevo y se suelta el viejo. */
    const changeUsername = useCallback(
        async (raw) => {
            const username = normalizeUsername(raw);
            const problema = usernameError(username);
            if (problema) throw new Error(problema);
            if (!profile) throw new Error("Primero entra con tu cuenta");
            if (username === profile.username) return username;

            if (!(await claimUsername(username, user.uid))) throw new Error("Ese usuario ya está ocupado");
            await setDoc(doc(db, "profiles", user.uid), { username }, { merge: true });
            if (profile.username) await deleteDoc(doc(db, "codes", profile.username)).catch(() => {});
            setProfile((current) => ({ ...current, username }));
            return username;
        },
        [profile, user],
    );

    const accept = useCallback((friend) => updateDoc(doc(db, "friendships", friend.id), { status: "accepted" }), []);
    const remove = useCallback((friend) => deleteDoc(doc(db, "friendships", friend.id)), []);

    /** Dejarle un título a alguien para que lo vea cuando entre. */
    const recommend = useCallback(
        async (item, friend, note = null) => {
            await setDoc(doc(db, "users", friend.uid, "recs", item.id), {
                ...stripUndefined(item),
                note,
                from: { uid: user.uid, name: profile?.name ?? "Un amigo" },
                at: new Date().toISOString(),
            });
        },
        [user, profile],
    );

    const dismissRec = useCallback((item) => deleteDoc(doc(db, "users", user.uid, "recs", item.id)), [user]);

    const createList = useCallback(
        async (name, members = [], { emoji = DEFAULT_LOOK.emoji, color = DEFAULT_LOOK.color } = {}) => {
            const everyone = [user.uid, ...members.map((friend) => friend.uid)];
            const profiles = { [user.uid]: { name: profile?.name ?? "Yo", photo: profile?.photo ?? null } };
            members.forEach((friend) => (profiles[friend.uid] = { name: friend.name, photo: friend.photo ?? null }));

            const created = await addDoc(collection(db, "lists"), {
                name,
                emoji,
                color,
                members: everyone,
                profiles,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
            });
            return created.id;
        },
        [user, profile],
    );

    const me = useCallback(() => ({ uid: user.uid, name: profile?.name ?? "Alguien" }), [user, profile]);

    /**
     * Echar un título a una lista. Si ya estaba, no se toca (antes se le borraba la
     * palomita); si alguien lo había quitado, regresa. Dice cuál de las tres pasó.
     */
    const addToList = useCallback(
        async (listId, item) => {
            const reference = doc(db, "lists", listId, "items", item.id);
            const existing = await getDoc(reference);
            if (existing.exists() && !existing.data().removedAt) return "already";
            if (existing.exists()) {
                await updateDoc(reference, {
                    removedAt: null,
                    removedBy: null,
                    addedBy: me(),
                    addedAt: new Date().toISOString(),
                });
                return "restored";
            }
            await setDoc(reference, {
                ...toSharedItem(item),
                addedBy: me(),
                addedAt: new Date().toISOString(),
                watchedBy: {},
                votes: {},
                removedAt: null,
                removedBy: null,
            });
            return "added";
        },
        [me],
    );

    /** Quitar es borrado suave: se puede deshacer y queda en "Quitadas" un tiempo. */
    const removeFromList = useCallback(
        (listId, item) =>
            updateDoc(doc(db, "lists", listId, "items", item.id), { removedAt: new Date().toISOString(), removedBy: me() }),
        [me],
    );

    const restoreToList = useCallback(
        (listId, item) => updateDoc(doc(db, "lists", listId, "items", item.id), { removedAt: null, removedBy: null }),
        [],
    );

    /** Ya sin vuelta atrás. */
    const purgeFromList = useCallback((listId, item) => deleteDoc(doc(db, "lists", listId, "items", item.id)), []);

    /**
     * La palomita es de cada quien: que tú la hayas visto no quiere decir que la
     * vio todo el grupo. Las listas viejas tenían una sola para todos; al tocarla
     * se convierte a la nueva forma.
     */
    const markWatched = useCallback(
        (listId, item, watched) =>
            updateDoc(doc(db, "lists", listId, "items", item.id), {
                [`watchedBy.${user.uid}`]: watched ? new Date().toISOString() : deleteField(),
                ...(item.watched !== undefined ? { watched: deleteField(), watchedAt: deleteField() } : {}),
            }),
        [user],
    );

    const vote = useCallback(
        (listId, item, on) =>
            updateDoc(doc(db, "lists", listId, "items", item.id), { [`votes.${user.uid}`]: on ? true : deleteField() }),
        [user],
    );

    const inviteToList = useCallback(
        (list, friend) =>
            updateDoc(doc(db, "lists", list.id), {
                members: arrayUnion(friend.uid),
                [`profiles.${friend.uid}`]: { name: friend.name, photo: friend.photo ?? null },
            }),
        [],
    );

    /** Nombre, emoji y color. Si hay link de invitación, se le actualiza el nombre. */
    const updateList = useCallback(async (list, fields) => {
        await updateDoc(doc(db, "lists", list.id), fields);
        if (list.inviteToken && (fields.name || fields.emoji)) {
            await updateDoc(doc(db, "listInvites", list.inviteToken), {
                name: fields.name ?? list.name,
                emoji: fields.emoji ?? list.emoji ?? null,
            }).catch(() => {});
        }
    }, []);

    /**
     * El link para que alguien entre a la lista aunque no sea tu amigo todavía.
     * El token es la llave: sin él nadie puede ni ver la lista.
     */
    const inviteLink = useCallback(
        async (list) => {
            let token = list.inviteToken;
            if (!token) {
                token = randomToken();
                await setDoc(doc(db, "listInvites", token), {
                    listId: list.id,
                    name: list.name,
                    emoji: list.emoji ?? null,
                    by: me(),
                    createdAt: serverTimestamp(),
                });
                await updateDoc(doc(db, "lists", list.id), { inviteToken: token });
            }
            return `${location.origin}/?l=${token}`;
        },
        [me],
    );

    const lookupListInvite = useCallback(async (token) => {
        const found = await getDoc(doc(db, "listInvites", token));
        return found.exists() ? { token, ...found.data() } : null;
    }, []);

    const joinList = useCallback(
        (invite) =>
            updateDoc(doc(db, "lists", invite.listId), {
                members: arrayUnion(user.uid),
                [`profiles.${user.uid}`]: { name: profile?.name ?? "Alguien", photo: profile?.photo ?? null },
                [`joins.${user.uid}`]: invite.token,
            }),
        [user, profile],
    );

    /**
     * Salirse. Si eres el último, se borra todo: la lista, sus títulos (Firestore
     * no los borra solo y se quedarían huérfanos) y su link de invitación.
     */
    const leaveList = useCallback(
        async (list) => {
            if (list.members.length > 1) {
                await updateDoc(doc(db, "lists", list.id), { members: arrayRemove(user.uid) });
                return;
            }
            const items = await getDocs(collection(db, "lists", list.id, "items"));
            const references = items.docs.map((document) => document.ref);
            // Un batch aguanta 500 escrituras; la lista y su link van en el último
            for (let start = 0; start < references.length; start += 450) {
                const batch = writeBatch(db);
                references.slice(start, start + 450).forEach((reference) => batch.delete(reference));
                await batch.commit();
            }
            const batch = writeBatch(db);
            if (list.inviteToken) batch.delete(doc(db, "listInvites", list.inviteToken));
            batch.delete(doc(db, "lists", list.id));
            await batch.commit();
        },
        [user],
    );

    return {
        enabled,
        blocked,
        profile,
        profiles,
        friends,
        requests,
        sent,
        libraries,
        ratings,
        recs,
        lists,
        listsReady,
        listItems,
        invite,
        lookup,
        changeUsername,
        publishProfile,
        accept,
        remove,
        recommend,
        dismissRec,
        createList,
        addToList,
        removeFromList,
        restoreToList,
        purgeFromList,
        markWatched,
        vote,
        inviteToList,
        updateList,
        inviteLink,
        lookupListInvite,
        joinList,
        leaveList,
    };
}

const toFriend = (link, myUid, profiles = {}) => {
    const uid = link.members.find((member) => member !== myUid);
    // Manda el perfil en vivo; la copia guardada en la amistad es el respaldo
    const data = profiles[uid] ?? link.profiles?.[uid] ?? {};
    return { id: link.id, uid, name: data.name ?? "Alguien", photo: data.photo ?? null, status: link.status };
};

/** Para los links de invitación: largo y al azar, para que no se pueda adivinar. */
const randomToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(15));
    return [...bytes].map((byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 24);
};

/** Firestore no traga `undefined`, y los títulos de TMDB traen huecos. */
const stripUndefined = (object) =>
    Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
