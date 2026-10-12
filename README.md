# 🍿 QuéVeo

App para decidir qué ver sin dar vueltas. Deslizas películas y series como en Tinder,
armas tus listas y la app aprende qué te gusta para irte mostrando mejores opciones.

## Qué hace

- **Explorar deslizando**: → me gustó · ← no me interesa · ↑ pendiente · ↓ la vi y no me gustó.
  También con botones, por si vas con una sola mano.
- **Pestañas separadas para películas y series.**
- **Tus listas**: las que te gustaron (con calificación de 1 a 5 estrellas), las pendientes,
  las que no te gustaron y las descartadas.
- **Aprende de ti**: con cada decisión arma un perfil de géneros y épocas, y ordena la baraja
  según eso. Cada cierto número de tarjetas mete una “sorpresa” para no encerrarte en lo mismo.
- **Dónde verla en México**: en qué plataformas está incluida y en cuáles se renta o compra
  (datos de JustWatch vía TMDB).
- **“¿Qué vemos hoy?”**: filtras por el tiempo que tienes y la plataforma, y te propone una
  de tus pendientes.
- **Tu perfil**: cuántas llevas vistas, horas, calificación promedio y tus géneros favoritos.
- Tema claro y oscuro, pensada para el celular.

## Configuración

```bash
npm install
cp .env.example .env     # pega aquí tus llaves
npm run dev
```

**Sin configurar nada**, la app abre en *modo demo* con unos cuantos títulos de ejemplo.

### TMDB (necesario para el catálogo real)

1. Crea una cuenta en [themoviedb.org](https://www.themoviedb.org/).
2. **Settings → API → API Key (v3 auth)**.
3. Pégala en `.env` como `VITE_TMDB_KEY`.

### Firebase (opcional, para sincronizar entre dispositivos)

1. Crea un proyecto en la [consola de Firebase](https://console.firebase.google.com/) (plan Spark, gratis).
2. **Authentication → Sign-in method → Google**: actívalo.
3. **Firestore Database**: créala en modo producción y pon esta regla, para que cada quien
   solo pueda leer y escribir lo suyo:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

4. **Configuración del proyecto → Tus apps → Web**: copia los valores a `.env`.

Sin Firebase, las listas se guardan en el navegador. Al entrar con Google por primera vez,
lo que tenías local se sube a tu cuenta.

## Cómo está armado

```
src/lib/tmdb.js     ← catálogo: explorar, buscar, ficha, plataformas (con modo demo)
src/lib/taste.js    ← perfil de gustos, orden de la baraja y "qué vemos hoy"
src/lib/library.js  ← tus listas: Firestore si hay sesión, localStorage si no
src/components/     ← tarjeta deslizable, pósters, ficha y selector del día
```

La lógica de gustos está separada de React y no toca el navegador, así que se prueba sola:
**14 pruebas** cubren el perfil de géneros, el arranque en frío, que un género que te gusta
nunca termine en la lista de evitados, el orden de la baraja y los filtros de “qué vemos hoy”.

```bash
npm test
```

## Stack

React · Vite · Firebase (Auth + Firestore) · TMDB · Vitest

Este producto usa la API de TMDB, pero no está avalado ni certificado por TMDB.
