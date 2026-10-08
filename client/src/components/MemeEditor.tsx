/**
 * The meme maker: text boxes you can drag, stretch, recolor and round, plus a
 * freehand "annotator" pen. Built for speed on phones:
 *  - one caption box is ready (and selected) as soon as the round starts,
 *  - tap a box to select it, type in the field below, drag to move,
 *  - pull the side handle to widen, the bottom handle to make it taller.
 */
import { BG_COLORS, DESIGN_LIMITS, DRAW_COLORS, DRAW_WIDTHS, TEXT_COLORS, type MemeDesign, type Stroke, type TextBox } from "@shared/design";
import type { MemeTemplate } from "@shared/templates";
import { textLength, truncate } from "@shared/text";
import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { t } from "../i18n/ar";
import { boxStyle, STROKE_PX, StrokesLayer, strokePath, TemplateImage } from "./MemeView";

const QUICK_EMOJI = ["😂", "🤣", "😭", "💀", "🙄", "😎", "🤔", "😡", "🔥", "👀"];

let idCounter = 0;
const newId = () => `b${Date.now().toString(36)}${idCounter++}`;

export function newBox(position: "top" | "bottom" | "middle" = "bottom"): TextBox {
  const y = position === "top" ? 3 : position === "middle" ? 40 : 76;
  return { id: newId(), text: "", x: 5, y, w: 90, h: 20, color: "#FFFFFF", bg: "transparent", rounded: false, size: DESIGN_LIMITS.defaultFont };
}

type Drag =
  | { kind: "move" | "resize-w" | "resize-h" | "resize-wh"; id: string; startX: number; startY: number; box: TextBox; rect: DOMRect }
  | { kind: "draw"; rect: DOMRect };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

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
  const [mode, setMode] = useState<"text" | "draw">("text");
  const [penColor, setPenColor] = useState<string>(DRAW_COLORS[0]);
  const [penWidth, setPenWidth] = useState<number>(2);
  const [liveStroke, setLiveStroke] = useState<Stroke | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<Drag | null>(null);
  const designRef = useRef(design);
  designRef.current = design;

  const box = design.boxes.find((b) => b.id === selected) ?? null;
  const totalChars = design.boxes.reduce((a, b) => a + textLength(b.text), 0);

  const updateBox = (id: string, patch: Partial<TextBox>) =>
    onChange({ ...designRef.current, boxes: designRef.current.boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  const addBox = () => {
    if (design.boxes.length >= DESIGN_LIMITS.maxBoxes) return;
    const b = newBox(design.boxes.length === 0 ? (template.captionPosition ?? "bottom") : "middle");
    onChange({ ...design, boxes: [...design.boxes, b] });
    setSelected(b.id);
    setMode("text");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removeBox = (id: string) => {
    const boxes = design.boxes.filter((b) => b.id !== id);
    onChange({ ...design, boxes });
    setSelected(boxes[boxes.length - 1]?.id ?? null);
  };

  /* ----- pointer handling (mouse + touch) ----- */

  const startBoxDrag = (e: RPointerEvent, b: TextBox, kind: "move" | "resize-w" | "resize-h" | "resize-wh") => {
    if (disabled || mode !== "text" || !layerRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(b.id);
    drag.current = { kind, id: b.id, startX: e.clientX, startY: e.clientY, box: { ...b }, rect: layerRef.current.getBoundingClientRect() };
  };

  const startDraw = (e: RPointerEvent) => {
    if (disabled || mode !== "draw" || !layerRef.current) return;
    if (design.strokes.length >= DESIGN_LIMITS.maxStrokes) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = layerRef.current.getBoundingClientRect();
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
        if (Math.hypot(x - s.points[n - 2], y - s.points[n - 1]) < 7) return s; // keep strokes light
        return { ...s, points: [...s.points, x, y] };
      });
      return;
    }
    const dx = ((e.clientX - d.startX) / d.rect.width) * 100;
    const dy = ((e.clientY - d.startY) / d.rect.height) * 100;
    const b = d.box;
    const min = DESIGN_LIMITS.minBoxSize;
    if (d.kind === "move") {
      updateBox(d.id, { x: round1(clamp(b.x + dx, 0, 100 - b.w)), y: round1(clamp(b.y + dy, 0, 100 - b.h)) });
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
      if (room >= 4) {
        const pts = liveStroke.points.slice(0, room & ~1);
        onChange({ ...designRef.current, strokes: [...designRef.current.strokes, { ...liveStroke, points: pts }] });
      }
      setLiveStroke(null);
    }
  };

  return (
    <div className={`editor ${disabled ? "is-disabled" : ""}`}>
      <figure className={`meme meme-hero editor-canvas mode-${mode}`}>
        <TemplateImage template={template} />
        <div
          className="meme-layer"
          ref={layerRef}
          onPointerDown={(e) => (mode === "draw" ? startDraw(e) : setSelected(null))}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
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
              className={`tbox editable ${b.bg === "transparent" ? "is-outlined" : ""} ${b.id === selected ? "is-selected" : ""}`}
              style={boxStyle(b)}
              dir="auto"
              onPointerDown={(e) => startBoxDrag(e, b, "move")}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onDoubleClick={() => inputRef.current?.focus()}
            >
              <span className={b.text ? "" : "placeholder"}>{b.text || t.boxPlaceholder}</span>
              {b.id === selected && mode === "text" && !disabled && (
                <>
                  <i className="handle handle-w" onPointerDown={(e) => startBoxDrag(e, b, "resize-w")} onPointerMove={onMove} onPointerUp={onUp} aria-label={t.widen} />
                  <i className="handle handle-h" onPointerDown={(e) => startBoxDrag(e, b, "resize-h")} onPointerMove={onMove} onPointerUp={onUp} aria-label={t.taller} />
                  <i className="handle handle-wh" onPointerDown={(e) => startBoxDrag(e, b, "resize-wh")} onPointerMove={onMove} onPointerUp={onUp} />
                </>
              )}
            </div>
          ))}
        </div>
      </figure>

      {!disabled && (
        <div className="toolbar">
          <div className="tool-row">
            <button type="button" className={`tool ${mode === "text" ? "on" : ""}`} onClick={() => setMode("text")}>
              🔤 {t.textMode}
            </button>
            <button type="button" className="tool" onClick={addBox} disabled={design.boxes.length >= DESIGN_LIMITS.maxBoxes}>
              ➕ {t.addBox}
            </button>
            <button type="button" className={`tool ${mode === "draw" ? "on" : ""}`} onClick={() => setMode("draw")}>
              ✏️ {t.annotate}
            </button>
          </div>

          {mode === "text" && box && (
            <div className="tool-panel">
              <textarea
                ref={inputRef}
                className="input textarea"
                rows={2}
                dir="rtl"
                value={box.text}
                placeholder={t.captionPlaceholder}
                autoFocus
                onChange={(e) => {
                  const others = totalChars - textLength(box.text);
                  const max = Math.min(DESIGN_LIMITS.maxBoxChars, DESIGN_LIMITS.maxTotalChars - others);
                  updateBox(box.id, { text: truncate(e.target.value.replace(/\n/g, " "), max) });
                }}
              />
              <div className="emoji-row">
                {QUICK_EMOJI.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => updateBox(box.id, { text: truncate(box.text + em, DESIGN_LIMITS.maxBoxChars) })}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <div className="style-row">
                <span className="style-label">{t.fontColor}</span>
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch ${box.color === c ? "on" : ""}`}
                    style={{ background: c }}
                    aria-label={c}
                    onClick={() => updateBox(box.id, { color: c })}
                  />
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
                <button type="button" className={`tool tool-sm ${box.rounded ? "on" : ""}`} onClick={() => updateBox(box.id, { rounded: !box.rounded })}>
                  ▢ {t.rounded}
                </button>
                <button
                  type="button"
                  className="tool tool-sm"
                  onClick={() => updateBox(box.id, { size: Math.max(DESIGN_LIMITS.minFont, box.size - 1) })}
                  aria-label={t.smaller}
                >
                  A−
                </button>
                <button
                  type="button"
                  className="tool tool-sm"
                  onClick={() => updateBox(box.id, { size: Math.min(DESIGN_LIMITS.maxFont, box.size + 1) })}
                  aria-label={t.bigger}
                >
                  A+
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
                  <button
                    key={c}
                    type="button"
                    className={`swatch ${penColor === c ? "on" : ""}`}
                    style={{ background: c }}
                    aria-label={c}
                    onClick={() => setPenColor(c)}
                  />
                ))}
              </div>
              <div className="style-row">
                <span className="style-label">{t.penWidth}</span>
                {DRAW_WIDTHS.map((w) => (
                  <button key={w} type="button" className={`tool tool-sm ${penWidth === w ? "on" : ""}`} onClick={() => setPenWidth(w)}>
                    <span className="pen-dot" style={{ width: STROKE_PX[w] + 2, height: STROKE_PX[w] + 2 }} />
                  </button>
                ))}
                <button
                  type="button"
                  className="tool tool-sm"
                  disabled={!design.strokes.length}
                  onClick={() => onChange({ ...design, strokes: design.strokes.slice(0, -1) })}
                >
                  ↩ {t.undo}
                </button>
                <button
                  type="button"
                  className="tool tool-sm tool-danger"
                  disabled={!design.strokes.length}
                  onClick={() => onChange({ ...design, strokes: [] })}
                >
                  🧽 {t.clearDrawing}
                </button>
              </div>
              <p className="hint">{t.drawHint}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
