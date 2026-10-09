import { SERVER_URL } from "./config";

/**
 * Template images can be:
 *  - "/api/img/<id>"  → served (and cached) by the game server, from Google Drive
 *  - "/templates/x"   → built-in files on the website
 *  - "https://…"      → any public URL
 */
export function imageSrc(image: string): string {
  if (image.startsWith("/api/") && SERVER_URL) return `${SERVER_URL}${image}`;
  return image;
}
