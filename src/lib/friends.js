import { useCallback, useEffect, useMemo, useState } from "react";
import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { cloudEnabled, db } from "./firebase";
import { friendshipId, normalizeUsername, ratingsByItem, suggestUsername, usernameError } from "./social";

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
    const enabled = Boolean(cloudEnabled && user);

    useEffect(() => {
        if (!enabled) {
            setProfile(null);
            setLinks([]);
            setLibraries({});
            setRecs([]);
            setLists([]);
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
        });
    }, [enabled, user]);

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
        async (name, members = []) => {
            const everyone = [user.uid, ...members.map((friend) => friend.uid)];
            const profiles = { [user.uid]: { name: profile?.name ?? "Yo", photo: profile?.photo ?? null } };
            members.forEach((friend) => (profiles[friend.uid] = { name: friend.name, photo: friend.photo ?? null }));

            const created = await addDoc(collection(db, "lists"), {
                name,
                members: everyone,
                profiles,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
            });
            return created.id;
        },
        [user, profile],
    );

    const addToList = useCallback(
        (listId, item) =>
            setDoc(doc(db, "lists", listId, "items", item.id), {
                ...stripUndefined(item),
                addedBy: { uid: user.uid, name: profile?.name ?? "Alguien" },
                addedAt: new Date().toISOString(),
                watched: false,
            }),
        [user, profile],
    );

    const removeFromList = useCallback((listId, itemId) => deleteDoc(doc(db, "lists", listId, "items", itemId)), []);

    const markWatched = useCallback(
        (listId, item, watched) =>
            updateDoc(doc(db, "lists", listId, "items", item.id), {
                watched,
                watchedAt: watched ? new Date().toISOString() : null,
            }),
        [],
    );

    const inviteToList = useCallback(
        (list, friend) =>
            updateDoc(doc(db, "lists", list.id), {
                members: arrayUnion(friend.uid),
                [`profiles.${friend.uid}`]: { name: friend.name, photo: friend.photo ?? null },
            }),
        [],
    );

    const leaveList = useCallback(
        (list) =>
            list.members.length <= 1
                ? deleteDoc(doc(db, "lists", list.id))
                : updateDoc(doc(db, "lists", list.id), { members: arrayRemove(user.uid) }),
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
        markWatched,
        inviteToList,
        leaveList,
    };
}

/** Escucha los títulos de una lista en conjunto mientras está abierta. */
export function useSharedItems(listId) {
    const [items, setItems] = useState([]);

    useEffect(() => {
        if (!cloudEnabled || !listId) {
            setItems([]);
            return;
        }
        return onSnapshot(collection(db, "lists", listId, "items"), (snapshot) => {
            setItems(snapshot.docs.map((document) => ({ ...document.data(), id: document.id })));
        });
    }, [listId]);

    return items;
}

const toFriend = (link, myUid, profiles = {}) => {
    const uid = link.members.find((member) => member !== myUid);
    // Manda el perfil en vivo; la copia guardada en la amistad es el respaldo
    const data = profiles[uid] ?? link.profiles?.[uid] ?? {};
    return { id: link.id, uid, name: data.name ?? "Alguien", photo: data.photo ?? null, status: link.status };
};

/** Firestore no traga `undefined`, y los títulos de TMDB traen huecos. */
const stripUndefined = (object) =>
    Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
