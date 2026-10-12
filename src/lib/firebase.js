/**
 * Firebase es opcional: si no configuras las variables de entorno, la app funciona
 * igual guardando todo en el navegador. Con ellas, se sincroniza entre dispositivos.
 */
import { initializeApp } from "firebase/app";
import {
    GoogleAuthProvider,
    connectAuthEmulator,
    createUserWithEmailAndPassword,
    getAuth,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const cloudEnabled = Boolean(config.apiKey && config.projectId);

let app = null;
let auth = null;
let db = null;

if (cloudEnabled) {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);

    // Para desarrollo: `VITE_EMULATOR=1 npm run dev` apunta todo al emulador local,
    // así se pueden probar las reglas y el flujo de amigos sin tocar los datos reales.
    if (import.meta.env.DEV && import.meta.env.VITE_EMULATOR === "1") {
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
        window.__qv = {
            async signInAs(email, name) {
                try {
                    await createUserWithEmailAndPassword(auth, email, "prueba1234");
                } catch {
                    await signInWithEmailAndPassword(auth, email, "prueba1234");
                }
                if (name && auth.currentUser.displayName !== name) await updateProfile(auth.currentUser, { displayName: name });
                return auth.currentUser.uid;
            },
        };
    }
}

export { auth, db };

export function loginWithGoogle() {
    if (!auth) throw new Error("Falta configurar Firebase");
    return signInWithPopup(auth, new GoogleAuthProvider());
}

export function logout() {
    return auth ? signOut(auth) : Promise.resolve();
}
