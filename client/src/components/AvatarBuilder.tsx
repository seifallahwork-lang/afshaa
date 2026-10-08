import { AVATAR_PARTS, randomAvatar, type Avatar as AvatarData, type AvatarPart } from "@shared/avatar";
import { useState } from "react";
import { t } from "../i18n/ar";
import { Avatar, BG, EYE_COLOR, HAIR_COLOR, SKIN } from "./Avatar";
import { Button } from "./ui";

const TABS: { part: AvatarPart; label: string; colors?: string[] }[] = [
  { part: "hair", label: "التسريحة" },
  { part: "hairColor", label: "لون الشعر", colors: HAIR_COLOR },
  { part: "skin", label: "البشرة", colors: SKIN },
  { part: "eyes", label: "شكل العين" },
  { part: "eyeColor", label: "لون العين", colors: EYE_COLOR },
  { part: "mouth", label: "البُق" },
  { part: "beard", label: "الدقن" },
  { part: "glasses", label: "النضارة" },
  { part: "hat", label: "الطاقية" },
  { part: "bg", label: "الخلفية", colors: BG },
];

/** Full-screen sheet to build an avatar quickly. Shape options show live mini-previews. */
export function AvatarBuilder({
  value,
  onDone,
}: {
  value: AvatarData;
  onDone: (a: AvatarData) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [tab, setTab] = useState<AvatarPart>("hair");
  const current = TABS.find((x) => x.part === tab)!;
  const set = (part: AvatarPart, v: number) => setDraft((d) => ({ ...d, [part]: v }));

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={t.avatarTitle}>
      <div className="sheet avatar-sheet">
        <div className="avatar-preview">
          <Avatar avatar={draft} size={132} />
          <Button variant="secondary" type="button" onClick={() => setDraft(randomAvatar())}>
            🎲 {t.avatarRandom}
          </Button>
        </div>

        <div className="avatar-tabs" role="tablist">
          {TABS.map((x) => (
            <button
              key={x.part}
              role="tab"
              type="button"
              aria-selected={x.part === tab}
              className={x.part === tab ? "on" : ""}
              onClick={() => setTab(x.part)}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="avatar-options" role="radiogroup" aria-label={current.label}>
          {Array.from({ length: AVATAR_PARTS[tab] }, (_, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={draft[tab] === i}
              className={`avatar-option ${draft[tab] === i ? "on" : ""}`}
              onClick={() => set(tab, i)}
            >
              {current.colors ? (
                <span className="swatch-big" style={{ background: current.colors[i] }} />
              ) : (
                <Avatar avatar={{ ...draft, [tab]: i }} size={56} />
              )}
            </button>
          ))}
        </div>

        <Button className="btn-big" type="button" onClick={() => onDone(draft)}>
          {t.avatarDone}
        </Button>
      </div>
    </div>
  );
}
