/**
 * Custom agent avatars.
 *
 * The built-in faces are inline SVG figures (see components/agent-figure.tsx)
 * referenced by a short `bust:<figure>:<tone>` key, so they follow the theme
 * and cost almost nothing to store. This module covers the other case: an
 * image the admin uploads, which is downscaled to a square data URI so a
 * custom avatar needs no upload endpoint or storage round-trip.
 */

/** Upper bound on a custom avatar data URI, enforced on both ends. */
export const MAX_AVATAR_DATA_URI_LENGTH = 60_000;

export async function imageFileToAvatarDataUri(
  file: File,
  size = 128,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not process that image.");

  // Cover-crop to a square so portraits and landscapes both look right.
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  bitmap.close();

  const dataUri = canvas.toDataURL("image/webp", 0.82);
  if (dataUri.length > MAX_AVATAR_DATA_URI_LENGTH) {
    // Fall back to a smaller, more compressed rendition before giving up.
    const smaller = canvas.toDataURL("image/webp", 0.6);
    if (smaller.length > MAX_AVATAR_DATA_URI_LENGTH) {
      throw new Error("That image is too detailed to store. Try a simpler one.");
    }
    return smaller;
  }
  return dataUri;
}
