/**
 * Loads meme templates from a public Google Drive folder.
 *
 * Folder rules (no code changes needed to add memes):
 *  - Every image in the folder (or in its sub-folders) becomes a template.
 *  - Sub-folder name = category (e.g. "كورة", "أفلام"). Images directly in the
 *    main folder get the category "Random".
 *  - A sub-folder named "مخفي" or "hidden" is ignored (hide a meme by moving it there).
 *  - File name starting with "top" or "فوق" → caption drawn at the TOP of the image;
 *    otherwise at the bottom. The rest of the file name is the meme's name.
 *
 * The folder must be shared as "Anyone with the link can view".
 * Needs a Google API key with the Drive API enabled (Cloudflare secret GOOGLE_API_KEY).
 */
import type { MemeTemplate } from "../../../shared/templates";

const API = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const HIDDEN_FOLDERS = new Set(["مخفي", "hidden"]);
const MAX_FOLDERS = 30;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

type Fetch = typeof fetch;

async function listChildren(folderId: string, apiKey: string, fetchFn: Fetch): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: "1000",
      key: apiKey,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetchFn(`${API}?${params}`);
    if (!res.ok) throw new Error(`Drive API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

/** Public image URL for a Drive file (works for "anyone with the link" files). */
export const driveImageUrl = (fileId: string) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;

/** "top - الواد بيبص.jpg" → { name: "الواد بيبص", position: "top" } */
export function parseFileName(fileName: string): { name: string; position: "top" | "bottom" } {
  const base = fileName.replace(/\.[a-z0-9]{2,5}$/i, "").trim();
  const m = base.match(/^(top|فوق)\s*[-_–:]?\s*(.*)$/i);
  if (m) return { name: m[2].trim() || base, position: "top" };
  return { name: base, position: "bottom" };
}

function toTemplate(file: DriveFile, category: string): MemeTemplate {
  const { name, position } = parseFileName(file.name);
  return {
    id: `gd_${file.id}`,
    image: driveImageUrl(file.id),
    name,
    categories: [category],
    captionPosition: position,
  };
}

export async function loadDriveTemplates(
  folderId: string,
  apiKey: string,
  fetchFn: Fetch = fetch,
): Promise<MemeTemplate[]> {
  const top = await listChildren(folderId, apiKey, fetchFn);
  const templates: MemeTemplate[] = [];
  const subfolders: DriveFile[] = [];

  for (const f of top) {
    if (f.mimeType === FOLDER_MIME) {
      if (!HIDDEN_FOLDERS.has(f.name.trim().toLowerCase())) subfolders.push(f);
    } else if (f.mimeType.startsWith("image/")) {
      templates.push(toTemplate(f, "Random"));
    }
  }

  const nested = await Promise.all(
    subfolders.slice(0, MAX_FOLDERS).map(async (folder) => {
      const children = await listChildren(folder.id, apiKey, fetchFn);
      return children.filter((c) => c.mimeType.startsWith("image/")).map((c) => toTemplate(c, folder.name.trim()));
    }),
  );
  for (const list of nested) templates.push(...list);
  return templates;
}
