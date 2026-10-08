/**
 * "Generate hint": a vision model looks at the meme image and gives a short
 * Egyptian-Arabic nudge (not a finished caption).
 *
 * Uses Cloudflare Workers AI (binding "AI" in wrangler.jsonc). It's included
 * in the free Workers plan (10,000 Neurons/day) — no API key needed.
 */
import type { MemeTemplate } from "../../../shared/templates";

export const HINT_MODEL = "@cf/google/gemma-4-26b-a4b-it";

const SYSTEM = `انت مساعد ظريف في لعبة ميمز مصرية اسمها "قفشة".
اللاعب هيكتب كابشن مضحك على الصورة، وانت هتديله تلميح بس.
القواعد:
- اكتب بالعامية المصرية.
- جملتين بالكتير، أقل من 35 كلمة.
- اوصف الموقف أو الإحساس اللي في الصورة، واقترح زاوية أو موقف من الحياة اليومية في مصر يركب عليها.
- ماتكتبش الكابشن نفسه كامل.
- من غير ألفاظ خارجة، ومن غير ما تذكر أسماء أشخاص حقيقيين.`;

const USER = "ادّيني تلميح للصورة دي.";

/** Workers AI typing kept loose on purpose (model schemas change). */
export interface AiBinding {
  run(model: string, input: unknown): Promise<unknown>;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Smaller Drive thumbnail = faster + cheaper for the model. */
function imageUrlForAi(image: string): string | null {
  if (!/^https?:\/\//.test(image)) return null; // built-in placeholder SVGs aren't sent to the AI
  return image.replace(/([?&]sz=)w\d+/, "$1w768");
}

function extractText(res: unknown): string {
  const r = res as {
    response?: unknown;
    choices?: { message?: { content?: unknown } }[];
  };
  const content = r?.choices?.[0]?.message?.content ?? r?.response;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === "string" ? c : (c?.text ?? ""))).join(" ");
  return "";
}

export class HintUnavailable extends Error {}

export async function generateHint(ai: AiBinding | undefined, template: MemeTemplate, fetchFn: typeof fetch = fetch): Promise<string> {
  if (!ai) throw new HintUnavailable("Workers AI binding missing");
  const url = imageUrlForAi(template.image);
  if (!url) throw new HintUnavailable("Template image is not a web URL");

  const img = await fetchFn(url, { redirect: "follow" });
  const type = img.headers.get("content-type") ?? "";
  if (!img.ok || !type.startsWith("image/")) throw new Error(`Image fetch failed: ${img.status} ${type}`);
  const buf = await img.arrayBuffer();
  if (buf.byteLength > 4_000_000) throw new Error("Image too large for the AI");
  const dataUri = `data:${type.split(";")[0]};base64,${toBase64(buf)}`;

  const res = await ai.run(HINT_MODEL, {
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: USER },
          { type: "image_url", image_url: { url: dataUri, detail: "low" } },
        ],
      },
    ],
    max_completion_tokens: 600,
    temperature: 0.8,
  });

  const text = extractText(res)
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) throw new Error("Empty AI answer");
  return text.length > 260 ? `${text.slice(0, 257)}…` : text;
}
