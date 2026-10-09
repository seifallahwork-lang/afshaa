/**
 * "Download meme": draws the template + crop + drawing + text boxes + caption
 * bar onto a canvas and saves it as a PNG. Mirrors MemeView's layout.
 */
import type { MemeDesign, TextBox } from "@shared/design";
import type { MemeTemplate } from "@shared/templates";
import { imageSrc } from "./images";

const STROKE_PX = [0, 3, 6, 11];
const FONT = '"Lalezar", "Baloo Bhaijaan 2", sans-serif';
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBox(ctx: CanvasRenderingContext2D, b: TextBox, W: number, H: number, y0: number) {
  const x = (b.x / 100) * W;
  const y = y0 + (b.y / 100) * H;
  const w = (b.w / 100) * W;
  const h = (b.h / 100) * H;
  const font = (b.size / 100) * W;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((b.rotate * Math.PI) / 180);
  if (b.bg !== "transparent") {
    ctx.fillStyle = b.bg;
    roundRect(ctx, -w / 2, -h / 2, w, h, b.rounded ? Math.min(font * 0.7, h / 2) : 0);
    ctx.fill();
  }
  ctx.font = `${font}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = hasArabic(b.text) ? "rtl" : "ltr";
  const lines = wrap(ctx, b.text, w - font * 0.6);
  const lh = font * 1.2;
  const top = -((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => {
    const ly = top + i * lh;
    if (b.outline) {
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(2, font * 0.16);
      ctx.strokeStyle = b.color.toUpperCase() === "#000000" ? "#fff" : "#000";
      ctx.strokeText(l, 0, ly);
    }
    ctx.fillStyle = b.color;
    ctx.fillText(l, 0, ly);
  });
  ctx.restore();
}

export async function renderMeme(template: MemeTemplate, design: MemeDesign): Promise<Blob> {
  await document.fonts?.load(`40px ${FONT}`).catch(() => undefined);
  const img = await loadImage(imageSrc(template.image));
  const nw = img.naturalWidth || 800;
  const nh = img.naturalHeight || 600;
  const c = design.crop;
  const sx = c ? (c.x / 100) * nw : 0;
  const sy = c ? (c.y / 100) * nh : 0;
  const sw = c ? (c.w / 100) * nw : nw;
  const sh = c ? (c.h / 100) * nh : nh;

  const W = Math.round(Math.min(1200, Math.max(600, sw)));
  const H = Math.round((sh / sw) * W);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Caption bar outside the image
  let stripLines: string[] = [];
  const stripFont = W * 0.055;
  const stripPad = stripFont * 0.6;
  if (design.strip?.text) {
    ctx.font = `${stripFont}px ${FONT}`;
    stripLines = wrap(ctx, design.strip.text, W - stripPad * 2);
  }
  const stripH = stripLines.length ? stripLines.length * stripFont * 1.25 + stripPad * 2 : 0;
  canvas.width = W;
  canvas.height = H + stripH;
  const imgY = design.strip?.position === "top" ? stripH : 0;

  ctx.drawImage(img, sx, sy, sw, sh, 0, imgY, W, H);

  // Drawing
  const scale = W / 600;
  for (const s of design.strokes) {
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = (STROKE_PX[s.width] ?? 6) * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < s.points.length; i += 2) {
      const px = (s.points[i] / 1000) * W;
      const py = imgY + (s.points[i + 1] / 1000) * H;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  for (const b of design.boxes) drawBox(ctx, b, W, H, imgY);

  if (stripLines.length && design.strip) {
    const y = design.strip.position === "top" ? 0 : H;
    ctx.fillStyle = design.strip.bg;
    ctx.fillRect(0, y, W, stripH);
    ctx.fillStyle = design.strip.color;
    ctx.font = `${stripFont}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = hasArabic(design.strip.text) ? "rtl" : "ltr";
    stripLines.forEach((l, i) => ctx.fillText(l, W / 2, y + stripPad + stripFont * 0.62 + i * stripFont * 1.25));
  }

  // Small watermark
  ctx.font = `${W * 0.025}px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText("قفشة", W * 0.015, canvas.height - W * 0.02);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}

export async function downloadMeme(template: MemeTemplate, design: MemeDesign, name = "afsha-meme"): Promise<void> {
  const blob = await renderMeme(template, design);
  const file = new File([blob], `${name}.png`, { type: "image/png" });
  // Phones: the share sheet lets people save to photos or send to WhatsApp directly.
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
    try {
      await nav.share({ files: [file] });
      return;
    } catch {
      /* cancelled → fall back to a normal download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
