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
import { friendshipId, makeCode, normalizeCode, ratingsByItem } from "./social";

/** Lo que de verdad importa compartir: lo descartado no sale de tu cuenta. */
const SHARED_DECISIONS = ["liked", "disliked", "watchlist"];

const profileOf = (user, photo, name) => ({
    name: name ?? user.displayName ?? "Alguien",
    photo: photo ?? user.photoURL ?? null,
});

/** Mi perfil público y mi código para compartir; se crean la primera vez. */
async function ensureProfile(user, photo, name) {
    const reference = doc(db, "profiles", user.uid);
    const existing = await getDoc(reference);

    if (existing.exists() && existing.data().code) {
        // Lo que tú hayas puesto manda; de Google solo se toma lo que falte
        const saved = existing.data();
        const data = {
            name: saved.name ?? profileOf(user, photo, name).name,
            photo: saved.photo ?? profileOf(user, photo, name).photo,
            code: saved.code,
        };
        await setDoc(reference, data, { merge: true });
        return data;
    }

    // Se intenta hasta dar con un código libre: escribir sobre uno que ya existe
    // lo rechazan las reglas, así que el choque se nota aquí
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = makeCode();
        try {
            await setDoc(doc(db, "codes", code), { uid: user.uid });
            const data = { ...profileOf(user, photo, name), code };
            await setDoc(reference, data, { merge: true });
            return data;
        } catch {
            // código ocupado, va otro
        }
    }
    throw new Error("No se pudo generar tu código");
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
            .map((link) => toFriend(link, user.uid))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [links, user]);

    /** Invitaciones que me mandaron y todavía no contesto. */
    const requests = useMemo(() => {
        if (!user) return [];
        return links
            .filter((link) => link.status === "pending" && link.requestedBy !== user.uid)
            .map((link) => toFriend(link, user.uid));
    }, [links, user]);

    /** Las que mandé yo y siguen sin respuesta. */
    const sent = useMemo(() => {
        if (!user) return [];
        return links
            .filter((link) => link.status === "pending" && link.requestedBy === user.uid)
            .map((link) => toFriend(link, user.uid));
    }, [links, user]);

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

    const ratings = useMemo(() => ratingsByItem(libraries, friends), [libraries, friends]);

    /** Mandar invitación con el código que te pasaron. */
    const invite = useCallback(
        async (rawCode) => {
            const code = normalizeCode(rawCode);
            if (!profile) throw new Error("Primero entra con tu cuenta");
            if (code === profile.code) throw new Error("Ese es tu propio código");

            const found = await getDoc(doc(db, "codes", code));
            if (!found.exists()) throw new Error("No encontré a nadie con ese código");

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
        friends,
        requests,
        sent,
        libraries,
        ratings,
        recs,
        lists,
        invite,
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

const toFriend = (link, myUid) => {
    const uid = link.members.find((member) => member !== myUid);
    const data = link.profiles?.[uid] ?? {};
    return { id: link.id, uid, name: data.name ?? "Alguien", photo: data.photo ?? null, status: link.status };
};

/** Firestore no traga `undefined`, y los títulos de TMDB traen huecos. */
const stripUndefined = (object) =>
    Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
