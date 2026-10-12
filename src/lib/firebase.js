/**
 * Firebase es opcional: si no configuras las variables de entorno, la app funciona
 * igual guardando todo en el navegador. Con ellas, se sincroniza entre dispositivos.
 */
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
}

export { auth, db };

export function loginWithGoogle() {
    if (!auth) throw new Error("Falta configurar Firebase");
    return signInWithPopup(auth, new GoogleAuthProvider());
}

export function logout() {
    return auth ? signOut(auth) : Promise.resolve();
}
