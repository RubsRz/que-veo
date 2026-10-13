<img src="public/icon.svg" width="72" align="right" alt="" />

# QuéVeo

App para decidir qué ver sin dar vueltas. Deslizas películas y series como en Tinder,
armas tus listas y la app aprende qué te gusta para irte mostrando mejores opciones.

## Qué hace

- **Explorar deslizando**: → ya la vi (y la calificas) · ↑ quiero verla · ← no la he visto.
  Son tres acciones porque la calificación ya dice si te gustó. También con botones, por si
  vas con una sola mano. Un toque abre la ficha y dejar el dedo muestra el póster completo.
- **Películas y series** en la misma pantalla, con un interruptor.
- **Calificar de media en media estrella**, de 0.5 (*Desastre*) a 5 (*Obra maestra*): mientras
  arrastras el dedo ves el puntaje, su nombre y qué significa, y se guarda cuando confirmas.
- **Tus listas**: calificadas, quiero verlas y no las he visto. Cada una se abre a pantalla
  completa, con orden por recientes, calificación, año o nombre, en los dos sentidos, y en
  las calificadas se puede filtrar por cada puntaje.
- **Aprende de ti**: la calificación manda (5★ suma todo, 0.5★ resta todo), y con eso arma un
  perfil de géneros y épocas para ordenar la baraja. Cada 50 calificaciones recupera una de
  las que dijiste que no habías visto, la que más embone contigo, por si cambiaste de idea.
- **Dónde verla en México**: en qué plataformas está incluida y en cuáles se renta o compra
  (datos de JustWatch vía TMDB).
- **“¿Qué vemos hoy?”**: filtras por el tiempo que tienes y la plataforma, y te propone una
  de tus pendientes, de tus favoritas, de lo que les gustó a tus amigos o del catálogo.
- **Tu perfil**: cuántas llevas vistas, horas, calificación promedio y tus géneros favoritos.
- Tema claro y oscuro, pensada para el celular.

### Con amigos

- **Te agregas con un código** de seis caracteres; la otra persona acepta y listo.
- **En la baraja te avisa** con una burbuja en el póster: las fotos de quienes ya la vieron
  (dos y un “+N” si son más de tres). Al tocarla se ve quién dijo qué y con cuántas estrellas.
- **Afinidad**: de los títulos que los dos vieron, en cuántos opinaron igual.
- **Qué ver juntos**: lo que los dos tienen pendiente, lo que a esa persona le encantó y tú no
  has visto, y lo que tú le puedes recomendar.
- **Recomendaciones directas**: le mandas un título y le aparece en su pantalla de Amigos.
- **Listas en conjunto**: un “pendientes” compartido donde cualquiera agrega títulos y todos
  ven lo que falta; se marca lo que ya vieron.
- **Lo que anda viendo tu banda**: lo que le gustó a dos o más de tus amigos y tú no has visto.

Lo que descartas no se comparte nunca, y tus amigos solo pueden *leer* tus calificaciones.

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
3. **Firestore Database**: créala en modo producción. Las reglas están en
   [`firestore.rules`](firestore.rules) y se publican con:

   ```bash
   npx firebase login
   npx firebase deploy --only firestore:rules
   ```

   (o pegando el archivo en **Firestore → Reglas** de la consola). Sin ellas, la pantalla
   de Amigos avisa que falta este paso.

4. **Configuración del proyecto → Tus apps → Web**: copia los valores a `.env`.

Sin Firebase, las listas se guardan en el navegador. Al entrar con Google por primera vez,
lo que tenías local se sube a tu cuenta.

## Cómo está armado

La app tiene cuatro pantallas: **Explorar**, **Listas**, **Amigos** y **Perfil**.

```
src/lib/tmdb.js     ← catálogo: explorar, buscar, ficha, plataformas (con modo demo)
src/lib/taste.js    ← perfil de gustos, orden de la baraja y "qué vemos hoy"
src/lib/ratings.js  ← qué significa cada media estrella
src/lib/library.js  ← tus listas: Firestore si hay sesión, localStorage si no
src/lib/social.js   ← afinidad, qué ver juntos y quién opinó qué (sin Firebase de por medio)
src/lib/friends.js  ← amigos, recomendaciones y listas en conjunto, en vivo
src/components/     ← tarjeta deslizable, pósters, ficha, amigos y selector del día
src/components/Sheet.jsx     ← la hoja que usan todas las pantallas emergentes
src/components/SwipeCard.jsx ← los gestos de la baraja
firestore.rules     ← quién puede leer y escribir qué
```

### Los gestos y las hojas

Dos piezas se llevan el cuidado extra porque en el celular es donde se siente la app:

- **`SwipeCard`** escucha el arrastre en `window`, no en la tarjeta, para que el "soltaste"
  llegue aunque el dedo salga del elemento; cualquier cancelación (iOS corta el toque en
  cuanto cree que vas a hacer scroll) regresa la tarjeta a su lugar; y mientras arrastras no
  se re-dibuja nada, se mueve el nodo directo.
- **`Sheet`** siempre deja una ✕ a la vista, se cierra de cuatro formas (✕, tocar afuera,
  Escape y jalarla hacia abajo) y nunca puede quedar montada "a medias".

La lógica de gustos y la social están separadas de React y no tocan el navegador, así que se
prueban solas: **53 pruebas** cubren el perfil de géneros, el arranque en frío, el orden de la
baraja, los filtros de “qué vemos hoy”, el cálculo de afinidad, quién opinó de cada título y
qué proponerles para ver juntos.

```bash
npm test
```

### Probar con el emulador

Para el flujo de amigos hace falta más de una cuenta, así que se prueba contra el emulador de
Firebase (necesita Java):

```bash
npx firebase emulators:start --only firestore,auth
VITE_EMULATOR=1 npm run dev
```

Así nada toca los datos reales. Lo de la interfaz se prueba con Playwright sobre **WebKit**,
que es el motor de Safari: es donde salieron los problemas de gestos en iPhone.

## Stack

React · Vite · Firebase (Auth + Firestore) · TMDB · Vitest

Este producto usa la API de TMDB, pero no está avalado ni certificado por TMDB.
