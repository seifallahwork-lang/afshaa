import { describe, expect, it } from "vitest";
import { loadDriveTemplates, parseFileName } from "../src/templates/drive";

const FOLDER = "application/vnd.google-apps.folder";

/** Fake Drive API: root has 2 images, a "كورة" folder and a hidden folder. */
const tree: Record<string, { id: string; name: string; mimeType: string }[]> = {
  ROOT: [
    { id: "a1", name: "top - لما الامتحان يطلع سهل.jpg", mimeType: "image/jpeg" },
    { id: "a2", name: "قهوة.png", mimeType: "image/png" },
    { id: "doc", name: "notes.txt", mimeType: "text/plain" },
    { id: "F1", name: "كورة", mimeType: FOLDER },
    { id: "F2", name: "مخفي", mimeType: FOLDER },
  ],
  F1: [{ id: "b1", name: "فوق الحكم.webp", mimeType: "image/webp" }],
  F2: [{ id: "h1", name: "secret.jpg", mimeType: "image/jpeg" }],
};

const fakeFetch = (async (input: string | URL | Request) => {
  const url = new URL(String(input));
  expect(url.searchParams.get("key")).toBe("KEY");
  const parent = url.searchParams.get("q")!.match(/'([^']+)' in parents/)![1];
  return new Response(JSON.stringify({ files: tree[parent] ?? [] }), { status: 200 });
}) as typeof fetch;

describe("Google Drive templates", () => {
  it("reads images, sub-folder categories, caption position, and skips hidden", async () => {
    const t = await loadDriveTemplates("ROOT", "KEY", fakeFetch);
    expect(t.map((x) => x.id).sort()).toEqual(["gd_a1", "gd_a2", "gd_b1"]);
    const a1 = t.find((x) => x.id === "gd_a1")!;
    expect(a1.captionPosition).toBe("top");
    expect(a1.name).toBe("لما الامتحان يطلع سهل");
    expect(a1.categories).toEqual(["Random"]);
    expect(a1.image).toContain("a1");
    const b1 = t.find((x) => x.id === "gd_b1")!;
    expect(b1.categories).toEqual(["كورة"]);
    expect(b1.captionPosition).toBe("top");
    expect(t.find((x) => x.id === "gd_a2")!.captionPosition).toBe("bottom");
  });

  it("parses file names", () => {
    expect(parseFileName("TOP_cat.jpeg")).toEqual({ name: "cat", position: "top" });
    expect(parseFileName("عادي.jpg")).toEqual({ name: "عادي", position: "bottom" });
  });

  it("surfaces Drive errors (bad key) so the server can fall back", async () => {
    const bad = (async () => new Response("API key not valid", { status: 400 })) as unknown as typeof fetch;
    await expect(loadDriveTemplates("ROOT", "KEY", bad)).rejects.toThrow(/400/);
  });
});
