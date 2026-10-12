import { useEffect, useState } from "react";

/**
 * Foto de Google. Se pide con referrerPolicy="no-referrer" porque si no,
 * Google bloquea la imagen y sale rota. Si aun así falla, van las iniciales.
 */
export default function Avatar({ user }) {
    const [failed, setFailed] = useState(false);

    useEffect(() => setFailed(false), [user?.photoURL]);

    const initials = (user?.displayName ?? user?.email ?? "?")
        .split(" ")
        .map((word) => word[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    if (!user?.photoURL || failed) {
        return <span className="avatar avatar-initials">{initials}</span>;
    }

    return (
        <img
            className="avatar"
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
        />
    );
}
