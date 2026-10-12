/**
 * Deja una imagen lista para guardarla como foto de perfil: la recorta cuadrada
 * desde el centro, la baja a 160 px y la comprime. Quedan unos 10-20 KB, así que
 * cabe de sobra en un documento de Firestore (límite de 1 MB) y no hace falta
 * Firebase Storage, que en el plan gratis ya pide tarjeta.
 */
export async function toAvatarDataUrl(file, size = 160) {
    if (!file.type.startsWith("image/")) throw new Error("Eso no es una imagen.");
    if (file.size > 8 * 1024 * 1024) throw new Error("La imagen pesa más de 8 MB.");

    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    context.drawImage(
        bitmap,
        (bitmap.width - side) / 2, // recorte centrado
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size,
    );
    bitmap.close?.();

    return canvas.toDataURL("image/jpeg", 0.82);
}
