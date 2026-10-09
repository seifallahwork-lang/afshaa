/**
 * The meme maker. Built for speed on phones:
 *  - a caption box is ready (and selected) as soon as the round starts,
 *  - tap a box to select it, type below, drag to move,
 *  - side handle = wider, bottom handle = taller, corner = both, top knob = rotate,
 *  - ✏️ draw, ✂️ crop the picture, 💬 add a caption bar above/below the picture.
 */
import { BG_COLORS, DESIGN_LIMITS, DRAW_COLORS, DRAW_WIDTHS, TEXT_COLORS, type Crop, type MemeDesign, type Stroke, type TextBox } from "@shared/design";
import type { MemeTemplate } from "@shared/templates";
import { textLength, truncate } from "@shared/text";
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { t } from "../i18n";
import { boxClass, boxStyle, cropStyles, STROKE_PX, StripBar, StrokesLayer, strokePath, TemplateImage } from "./MemeView";

let idCounter = 0;
const newId = () => `b${Date.now().toString(36)}${idCounter++}`;

export function newBox(position: "top" | "bottom" | "middle" = "bottom"): TextBox {
  const y = position === "top" ? 3 : position === "middle" ? 40 : 76;
  return {
    id: newId(),
    text: "",
    x: 5,
    y,
    w: 90,
    h: 20,
    color: "#FFFFFF",
    bg: "transparent",
    rounded: false,
    size: DESIGN_LIMITS.defaultFont,
    rotate: 0,
    outline: true,
  };
}

type BoxDrag = { kind: "move" | "resize-w" | "resize-h" | "resize-wh" | "rotate"; id: string; startX: number; startY: number; box: TextBox; rect: DOMRect };
type CropDrag = { kind: "crop-move" | "crop-resize"; startX: number; startY: number; crop: Crop; rect: DOMRect };
type Drag = BoxDrag | CropDrag | { kind: "draw"; rect: DOMRect };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
type Mode = "text" | "draw" | "crop";

export function MemeEditor({
  template,
  design,
  onChange,
  disabled,
}: {
  template: MemeTemplate;
  design: MemeDesign;
  onChange: (d: MemeDesign) => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(design.boxes[0]?.id ?? null);
  const [mode, setMode] = useState<Mode>("text");
  const [penColor, setPenColor] = useState<string>(DRAW_COLORS[0]);
  const [penWidth, setPenWidth] = useState<number>(2);
  const [liveStroke, setLiveStroke] = useState<Stroke | null>(null);
  const [cropDraft, setCropDraft] = useState<Crop | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<Drag | null>(null);
  const designRef = useRef(design);
  designRef.current = design;

  // If the selected box disappeared (e.g. new meme), select the first one again.
  useEffect(() => {
    if (selected && !design.boxes.some((b) => b.id === selected)) setSelected(design.boxes[0]?.id ?? null);
  }, [design.boxes, selected]);
  const box = design.boxes.find((b) => b.id === selected) ?? null;
  const totalChars = design.boxes.reduce((a, b) => a + textLength(b.text), 0);
  const set = (patch: Partial<MemeDesign>) => onChange({ ...designRef.current, ...patch });
  const updateBox = (id: string, patch: Partial<TextBox>) =>
    set({ boxes: designRef.current.boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  const addBox = () => {
    if (design.boxes.length >= DESIGN_LIMITS.maxBoxes) return;
    const b = newBox(design.boxes.length === 0 ? (template.captionPosition ?? "bottom") : "middle");
    set({ boxes: [...design.boxes, b] });
    setSelected(b.id);
    setMode("text");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removeBox = (id: string) => {
    const boxes = design.boxes.filter((b) => b.id !== id);
    set({ boxes });
    setSelected(boxes[boxes.length - 1]?.id ?? null);
  };

  const enterCrop = () => {
    setMode("crop");
    setCropDraft(design.crop ?? { x: 0, y: 0, w: 100, h: 100, ar: natural ? natural.w / natural.h : 1 });
  };
  const applyCrop = () => {
    if (cropDraft) {
      const ar = natural ? natural.w / natural.h : cropDraft.ar;
      const full = cropDraft.w >= 99.5 && cropDraft.h >= 99.5;
      set({ crop: full ? null : { ...cropDraft, ar } });
    }
    setMode("text");
  };

  const toggleStrip = () =>
    set({ strip: design.strip ? null : { text: "", position: "top", color: "#000000", bg: "#FFFFFF" } });

  /* ----- pointer handling (mouse + touch) ----- */

  const rectNow = () => layerRef.current!.getBoundingClientRect();

  const startBoxDrag = (e: RPointerEvent, b: TextBox, kind: BoxDrag["kind"]) => {
    if (disabled || mode !== "text" || !layerRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(b.id);
    drag.current = { kind, id: b.id, startX: e.clientX, startY: e.clientY, box: { ...b }, rect: rectNow() };
  };

  const startCropDrag = (e: RPointerEvent, kind: CropDrag["kind"]) => {
    if (!cropDraft || !layerRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, startX: e.clientX, startY: e.clientY, crop: { ...cropDraft }, rect: rectNow() };
  };

  const startDraw = (e: RPointerEvent) => {
    if (disabled || mode !== "draw" || !layerRef.current) return;
    if (design.strokes.length >= DESIGN_LIMITS.maxStrokes) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = rectNow();
    drag.current = { kind: "draw", rect };
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000);
    setLiveStroke({ color: penColor, width: penWidth, points: [x, y, x, y] });
  };

  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "draw") {
      const x = clamp(Math.round(((e.clientX - d.rect.left) / d.rect.width) * 1000), 0, 1000);
      const y = clamp(Math.round(((e.clientY - d.rect.top) / d.rect.height) * 1000), 0, 1000);
      setLiveStroke((s) => {
        if (!s) return s;
        const n = s.points.length;
        if (Math.hypot(x - s.points[n - 2], y - s.points[n - 1]) < 7) return s;
        return { ...s, points: [...s.points, x, y] };
      });
      return;
    }
    const dx = ((e.clientX - d.startX) / d.rect.width) * 100;
    const dy = ((e.clientY - d.startY) / d.rect.height) * 100;
    if (d.kind === "crop-move" || d.kind === "crop-resize") {
      const c = d.crop;
      if (d.kind === "crop-move") setCropDraft({ ...c, x: round1(clamp(c.x + dx, 0, 100 - c.w)), y: round1(clamp(c.y + dy, 0, 100 - c.h)) });
      else setCropDraft({ ...c, w: round1(clamp(c.w + dx, 15, 100 - c.x)), h: round1(clamp(c.h + dy, 15, 100 - c.y)) });
      return;
    }
    if (!("box" in d)) return;
    const b = d.box;
    const min = DESIGN_LIMITS.minBoxSize;
    if (d.kind === "move") {
      updateBox(d.id, { x: round1(clamp(b.x + dx, 0, 100 - b.w)), y: round1(clamp(b.y + dy, 0, 100 - b.h)) });
    } else if (d.kind === "rotate") {
      const cx = d.rect.left + ((b.x + b.w / 2) / 100) * d.rect.width;
      const cy = d.rect.top + ((b.y + b.h / 2) / 100) * d.rect.height;
      let deg = Math.round((Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90);
      if (deg > 180) deg -= 360;
      if (Math.abs(deg) < 5) deg = 0; // snap straight
      updateBox(d.id, { rotate: deg });
    } else {
      const patch: Partial<TextBox> = {};
      if (d.kind !== "resize-h") patch.w = round1(clamp(b.w + dx, min, 100 - b.x));
      if (d.kind !== "resize-w") patch.h = round1(clamp(b.h + dy, min, 100 - b.y));
      updateBox(d.id, patch);
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "draw" && liveStroke) {
      const used = designRef.current.strokes.reduce((a, s) => a + s.points.length, 0);
      const room = DESIGN_LIMITS.maxPoints - used;
      if (room >= 4) set({ strokes: [...designRef.current.strokes, { ...liveStroke, points: liveStroke.points.slice(0, room & ~1) }] });
      setLiveStroke(null);
    }
  };

  const handlers = { onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp };
  const showCrop = mode === "crop";
  const crop = showCrop ? {} : cropStyles(design.crop);

  return (
    <div className={`editor ${disabled ? "is-disabled" : ""}`}>
      <figure className={`meme meme-hero editor-canvas mode-${mode}`}>
        {!showCrop && design.strip?.position === "top" && <StripBar strip={design.strip}>{design.strip.text || <span className="placeholder">{t.stripPlaceholder}</span>}</StripBar>}
        <div className="meme-stage" style={crop.stage}>
          <TemplateImage
            template={template}
            style={crop.img}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
          <div
            className="meme-layer"
            ref={layerRef}
            onPointerDown={(e) => (mode === "draw" ? startDraw(e) : mode === "text" ? setSelected(null) : undefined)}
            {...handlers}
          >
            {showCrop && cropDraft ? (
              <>
                <div className="crop-shade" />
                <div
                  className="crop-box"
                  style={{ left: `${cropDraft.x}%`, top: `${cropDraft.y}%`, width: `${cropDraft.w}%`, height: `${cropDraft.h}%` }}
                  onPointerDown={(e) => startCropDrag(e, "crop-move")}
                  {...handlers}
                >
                  <i className="handle handle-wh" onPointerDown={(e) => startCropDrag(e, "crop-resize")} {...handlers} />
                </div>
              </>
            ) : (
              <>
                <StrokesLayer strokes={design.strokes}>
                  {liveStroke && (
                    <path
                      d={strokePath(liveStroke)}
                      fill="none"
                      stroke={liveStroke.color}
                      strokeWidth={STROKE_PX[liveStroke.width]}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </StrokesLayer>
                {design.boxes.map((b) => (
                  <div
                    key={b.id}
                    className={`${boxClass(b)} editable ${b.id === selected ? "is-selected" : ""}`}
                    style={boxStyle(b)}
                    dir="auto"
                    onPointerDown={(e) => startBoxDrag(e, b, "move")}
                    onDoubleClick={() => inputRef.current?.focus()}
                    {...handlers}
                  >
                    <span className={b.text ? "" : "placeholder"}>{b.text || t.boxPlaceholder}</span>
                    {b.id === selected && mode === "text" && !disabled && (
                      <>
                        <i className="handle handle-rot" onPointerDown={(e) => startBoxDrag(e, b, "rotate")} {...handlers} aria-label={t.rotate} />
                        <i className="handle handle-w" onPointerDown={(e) => startBoxDrag(e, b, "resize-w")} {...handlers} aria-label={t.widen} />
                        <i className="handle handle-h" onPointerDown={(e) => startBoxDrag(e, b, "resize-h")} {...handlers} aria-label={t.taller} />
                        <i className="handle handle-wh" onPointerDown={(e) => startBoxDrag(e, b, "resize-wh")} {...handlers} />
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        {!showCrop && design.strip?.position === "bottom" && <StripBar strip={design.strip}>{design.strip.text || <span className="placeholder">{t.stripPlaceholder}</span>}</StripBar>}
      </figure>

      {!disabled && (
        <div className="toolbar">
          <div className="tool-row tool-row-5">
            <button type="button" className={`tool ${mode === "text" ? "on" : ""}`} onClick={() => setMode("text")}>
              🔤 {t.textMode}
            </button>
            <button type="button" className="tool" onClick={addBox} disabled={design.boxes.length >= DESIGN_LIMITS.maxBoxes}>
              ➕ {t.addBox}
            </button>
            <button type="button" className={`tool ${mode === "draw" ? "on" : ""}`} onClick={() => setMode("draw")}>
              ✏️ {t.annotate}
            </button>
            <button type="button" className={`tool ${mode === "crop" ? "on" : ""}`} onClick={enterCrop}>
              ✂️ {t.crop}
            </button>
            <button type="button" className={`tool ${design.strip ? "on" : ""}`} onClick={toggleStrip}>
              💬 {t.strip}
            </button>
          </div>

          {mode === "text" && design.strip && (
            <div className="tool-panel strip-panel">
              <input
                className="input input-sm"
                value={design.strip.text}
                placeholder={t.stripPlaceholder}
                dir="auto"
                onChange={(e) => set({ strip: { ...design.strip!, text: truncate(e.target.value, DESIGN_LIMITS.maxBoxChars) } })}
              />
              <div className="style-row">
                <button type="button" className={`tool tool-sm ${design.strip.position === "top" ? "on" : ""}`} onClick={() => set({ strip: { ...design.strip!, position: "top" } })}>
                  ⬆ {t.stripTop}
                </button>
                <button type="button" className={`tool tool-sm ${design.strip.position === "bottom" ? "on" : ""}`} onClick={() => set({ strip: { ...design.strip!, position: "bottom" } })}>
                  ⬇ {t.stripBottom}
                </button>
                {TEXT_COLORS.slice(0, 4).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch swatch-sm ${design.strip!.bg === c ? "on" : ""}`}
                    style={{ background: c }}
                    aria-label={c}
                    onClick={() => set({ strip: { ...design.strip!, bg: c, color: c === "#000000" || c === "#E4007C" ? "#FFFFFF" : "#000000" } })}
                  />
                ))}
                <button type="button" className="tool tool-sm tool-danger" onClick={toggleStrip}>
                  🗑 {t.stripRemove}
                </button>
              </div>
            </div>
          )}

          {mode === "text" && box && (
            <div className="tool-panel">
              <textarea
                ref={inputRef}
                className="input textarea"
                rows={2}
                dir="auto"
                value={box.text}
                placeholder={t.captionPlaceholder}
                autoFocus
                onChange={(e) => {
                  const others = totalChars - textLength(box.text);
                  const max = Math.min(DESIGN_LIMITS.maxBoxChars, DESIGN_LIMITS.maxTotalChars - others);
                  updateBox(box.id, { text: truncate(e.target.value.replace(/\n/g, " "), max) });
                }}
              />
              <div className="style-row">
                <span className="style-label">{t.fontColor}</span>
                {TEXT_COLORS.map((c) => (
                  <button key={c} type="button" className={`swatch ${box.color === c ? "on" : ""}`} style={{ background: c }} aria-label={c} onClick={() => updateBox(box.id, { color: c })} />
                ))}
              </div>
              <div className="style-row">
                <span className="style-label">{t.boxBg}</span>
                {BG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch ${box.bg === c ? "on" : ""} ${c === "transparent" ? "swatch-none" : ""}`}
                    style={{ background: c === "transparent" ? undefined : c }}
                    aria-label={c === "transparent" ? t.noBg : c}
                    onClick={() => updateBox(box.id, { bg: c })}
                  />
                ))}
              </div>
              <div className="style-row">
                <button type="button" className={`tool tool-sm ${box.outline ? "on" : ""}`} onClick={() => updateBox(box.id, { outline: !box.outline })}>
                  𝐀 {t.outline}
                </button>
                <button type="button" className={`tool tool-sm ${box.rounded ? "on" : ""}`} onClick={() => updateBox(box.id, { rounded: !box.rounded })}>
                  ▢ {t.rounded}
                </button>
                <button type="button" className="tool tool-sm" onClick={() => updateBox(box.id, { size: Math.max(DESIGN_LIMITS.minFont, box.size - 1) })} aria-label={t.smaller}>
                  A−
                </button>
                <button type="button" className="tool tool-sm" onClick={() => updateBox(box.id, { size: Math.min(DESIGN_LIMITS.maxFont, box.size + 1) })} aria-label={t.bigger}>
                  A+
                </button>
              </div>
              <div className="style-row">
                <button type="button" className="tool tool-sm" aria-label={t.rotateLeft} onClick={() => updateBox(box.id, { rotate: Math.max(-180, box.rotate - 15) })}>
                  ⟲ 15°
                </button>
                <span className="rot-val" dir="ltr">
                  {box.rotate}°
                </span>
                <button type="button" className="tool tool-sm" aria-label={t.rotateRight} onClick={() => updateBox(box.id, { rotate: Math.min(180, box.rotate + 15) })}>
                  ⟳ 15°
                </button>
                <button type="button" className="tool tool-sm tool-danger" onClick={() => removeBox(box.id)}>
                  🗑 {t.deleteBox}
                </button>
              </div>
              <span className="counter" dir="ltr">
                {t.chars(totalChars, DESIGN_LIMITS.maxTotalChars)}
              </span>
            </div>
          )}

          {mode === "text" && !box && <p className="hint">{design.boxes.length ? t.tapBox : t.addFirstBox}</p>}

          {mode === "draw" && (
            <div className="tool-panel">
              <div className="style-row">
                <span className="style-label">{t.penColor}</span>
                {DRAW_COLORS.map((c) => (
                  <button key={c} type="button" className={`swatch ${penColor === c ? "on" : ""}`} style={{ background: c }} aria-label={c} onClick={() => setPenColor(c)} />
                ))}
              </div>
              <div className="style-row">
                <span className="style-label">{t.penWidth}</span>
                {DRAW_WIDTHS.map((w) => (
                  <button key={w} type="button" className={`tool tool-sm ${penWidth === w ? "on" : ""}`} onClick={() => setPenWidth(w)}>
                    <span className="pen-dot" style={{ width: STROKE_PX[w] + 2, height: STROKE_PX[w] + 2 }} />
                  </button>
                ))}
                <button type="button" className="tool tool-sm" disabled={!design.strokes.length} onClick={() => set({ strokes: design.strokes.slice(0, -1) })}>
                  ↩ {t.undo}
                </button>
                <button type="button" className="tool tool-sm tool-danger" disabled={!design.strokes.length} onClick={() => set({ strokes: [] })}>
                  🧽 {t.clearDrawing}
                </button>
              </div>
              <p className="hint">{t.drawHint}</p>
            </div>
          )}

          {mode === "crop" && (
            <div className="tool-panel">
              <p className="hint">{t.cropHint}</p>
              <div className="style-row">
                <button type="button" className="tool tool-sm on" onClick={applyCrop}>
                  ✔ {t.cropApply}
                </button>
                <button
                  type="button"
                  className="tool tool-sm"
                  onClick={() => {
                    set({ crop: null });
                    setCropDraft({ x: 0, y: 0, w: 100, h: 100, ar: natural ? natural.w / natural.h : 1 });
                  }}
                >
                  ↺ {t.cropReset}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
