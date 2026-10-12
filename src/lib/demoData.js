/**
 * Datos de ejemplo para poder abrir la app sin llave de TMDB.
 * Son títulos reales con descripciones escritas a mano y sin pósters: en cuanto
 * pones tu VITE_TMDB_KEY, todo esto se reemplaza por el catálogo de verdad.
 */
const movie = (id, title, year, genreIds, vote, overview) => ({
    id,
    title,
    release_date: `${year}-01-01`,
    genre_ids: genreIds,
    vote_average: vote,
    vote_count: 5000,
    popularity: 100 - id,
    overview,
    poster_path: null,
    backdrop_path: null,
    runtime: 120,
});

const show = (id, name, year, genreIds, vote, overview) => ({
    id,
    name,
    first_air_date: `${year}-01-01`,
    genre_ids: genreIds,
    vote_average: vote,
    vote_count: 4000,
    popularity: 100 - id,
    overview,
    poster_path: null,
    backdrop_path: null,
    runtime: 50,
});

export const DEMO_MOVIES = [
    movie(1, "Dune: Parte Dos", 2024, [878, 12], 8.2, "Paul Atreides se une a los fremen para vengar a su familia."),
    movie(2, "Interestelar", 2014, [878, 18], 8.4, "Un grupo de exploradores busca un nuevo hogar para la humanidad."),
    movie(3, "Parásitos", 2019, [18, 53], 8.5, "Una familia se infiltra poco a poco en la casa de otra mucho más rica."),
    movie(4, "Mad Max: Furia en el camino", 2015, [28, 878], 7.6, "Una huida por el desierto perseguidos por un ejército."),
    movie(5, "El gran hotel Budapest", 2014, [35, 18], 8.1, "Un conserje y su aprendiz, metidos en el robo de un cuadro."),
    movie(6, "Coco", 2017, [16, 10751], 8.2, "Un niño cruza al mundo de los muertos para entender a su familia."),
    movie(7, "Whiplash", 2014, [18], 8.4, "Un baterista y un maestro que lo empuja hasta donde ya duele."),
    movie(8, "Get Out", 2017, [27, 53], 7.7, "Una visita a casa de los suegros que se vuelve una pesadilla."),
    movie(9, "Blade Runner 2049", 2017, [878, 53], 7.6, "Un replicante descubre un secreto que puede cambiarlo todo."),
    movie(10, "La La Land", 2016, [10749, 18], 7.9, "Dos soñadores en Los Ángeles entre el amor y la carrera."),
    movie(11, "El club de la pelea", 1999, [18, 53], 8.4, "Un oficinista insomne encuentra una válvula de escape peligrosa."),
    movie(12, "Spider-Man: Un nuevo universo", 2018, [16, 28], 8.4, "Miles Morales descubre que hay más de un Spider-Man."),
];

export const DEMO_TV = [
    show(101, "Breaking Bad", 2008, [18, 80], 8.9, "Un profesor de química con cáncer entra al negocio de las drogas."),
    show(102, "Chernobyl", 2019, [18], 8.7, "La historia del accidente nuclear y de quienes lo contuvieron."),
    show(103, "Severance", 2022, [878, 53], 8.4, "Empleados que separan por completo su memoria del trabajo y la de su casa."),
    show(104, "The Last of Us", 2023, [18, 10765], 8.5, "Un contrabandista cruza un país arrasado por un hongo."),
    show(105, "Dark", 2017, [878, 9648], 8.4, "Cuatro familias, un pueblo y un túnel que conecta distintas épocas."),
    show(106, "The Bear", 2022, [18, 35], 8.3, "Un chef regresa a Chicago a sacar adelante el changarro familiar."),
    show(107, "Arcane", 2021, [16, 10765], 8.7, "Dos hermanas terminan en bandos opuestos de una ciudad partida."),
    show(108, "Mr. Robot", 2015, [18, 80], 8.2, "Un hacker con problemas de identidad y una sociedad lista para caer."),
];
