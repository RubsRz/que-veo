import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, cloudEnabled, db } from "./firebase";

const LOCAL_KEY = "que-veo:library:v1";
const PHOTO_KEY = "que-veo:photo:v1";

const readLocal = () => {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? {};
    } catch {
        return {};
    }
};

const writeLocal = (library) => {
    try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(library));
    } catch {
        // modo privado: se queda solo en memoria
    }
};

/** Lo mínimo que guardamos de cada título, para no depender de TMDB al abrir las listas. */
const toEntry = (item, decision, stars) => ({
    id: item.id,
    tmdbId: item.tmdbId,
    type: item.type,
    title: item.title,
    year: item.year ?? null,
    poster: item.poster ?? null,
    rating: item.rating ?? null,
    runtime: item.runtime ?? null,
    genreIds: item.genreIds ?? [],
    providerIds: item.providerIds ?? [],
    decision,
    stars: stars ?? null,
    updatedAt: new Date().toISOString(),
});

/**
 * Tus listas. Si hay sesión de Firebase, viven en Firestore y se sincronizan solas;
 * si no, en el navegador. La interfaz es la misma en los dos casos.
 */
export function useLibrary() {
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(!cloudEnabled);
    const [library, setLibrary] = useState(readLocal);
    // `ready` evita que la baraja se arme antes de tener tus listas: si no,
    // al recargar salen otra vez títulos que ya habías calificado.
    const [libraryReady, setLibraryReady] = useState(!cloudEnabled);
    // Foto propia: si la pones, gana sobre la de Google
    const [photo, setPhoto] = useState(() => localStorage.getItem(PHOTO_KEY));

    useEffect(() => {
        if (!cloudEnabled) return;
        return onAuthStateChanged(auth, (current) => {
            setUser(current);
            setAuthReady(true);
            if (!current) {
                setLibrary(readLocal());
                setLibraryReady(true); // sin sesión, lo local ya está listo
            } else {
                setLibraryReady(false); // con sesión, se espera a Firestore
            }
        });
    }, []);

    // Con sesión: se escucha la colección del usuario en tiempo real
    useEffect(() => {
        if (!cloudEnabled || !user) return;
        return onSnapshot(collection(db, "users", user.uid, "items"), (snapshot) => {
            const next = {};
            snapshot.forEach((document) => (next[document.id] = document.data()));
            setLibrary(next);
            setLibraryReady(true);
        });
    }, [user]);

    // El perfil (de momento solo la foto) vive en su propio documento
    useEffect(() => {
        if (!cloudEnabled || !user) {
            setPhoto(localStorage.getItem(PHOTO_KEY));
            return;
        }
        return onSnapshot(doc(db, "users", user.uid), (snapshot) => {
            setPhoto(snapshot.data()?.photo ?? null);
        });
    }, [user]);

    /** Guarda (o quita, con null) tu foto propia. */
    const savePhoto = useCallback(
        async (dataUrl) => {
            setPhoto(dataUrl);
            if (cloudEnabled && user) {
                await setDoc(doc(db, "users", user.uid), { photo: dataUrl }, { merge: true });
            } else if (dataUrl) {
                localStorage.setItem(PHOTO_KEY, dataUrl);
            } else {
                localStorage.removeItem(PHOTO_KEY);
            }
        },
        [user],
    );

    const decide = useCallback(
        async (item, decision, stars = null) => {
            const entry = toEntry(item, decision, stars);
            setLibrary((current) => ({ ...current, [item.id]: entry }));

            if (cloudEnabled && user) {
                await setDoc(doc(db, "users", user.uid, "items", item.id), entry);
            } else {
                writeLocal({ ...readLocal(), [item.id]: entry });
            }
        },
        [user],
    );

    const forget = useCallback(
        async (id) => {
            setLibrary((current) => {
                const next = { ...current };
                delete next[id];
                return next;
            });

            if (cloudEnabled && user) {
                await deleteDoc(doc(db, "users", user.uid, "items", id));
            } else {
                const local = readLocal();
                delete local[id];
                writeLocal(local);
            }
        },
        [user],
    );

    /** Al entrar con cuenta por primera vez, se suben las listas que hiciste sin sesión. */
    const mergeLocalIntoCloud = useCallback(async () => {
        if (!cloudEnabled || !user) return 0;
        const local = readLocal();
        const entries = Object.values(local);
        await Promise.all(entries.map((entry) => setDoc(doc(db, "users", user.uid, "items", entry.id), entry)));
        if (entries.length) writeLocal({});
        return entries.length;
    }, [user]);

    const lists = useMemo(() => {
        const all = Object.values(library);
        return {
            liked: all.filter((entry) => entry.decision === "liked").sort(byRecent),
            watchlist: all.filter((entry) => entry.decision === "watchlist").sort(byRecent),
            disliked: all.filter((entry) => entry.decision === "disliked").sort(byRecent),
            skipped: all.filter((entry) => entry.decision === "skipped").sort(byRecent),
        };
    }, [library]);

    return { user, authReady, libraryReady, cloudEnabled, library, lists, photo, savePhoto, decide, forget, mergeLocalIntoCloud };
}

const byRecent = (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
