/**
 * Original, hand-built SVG avatars. Each part is an index into the lists below
 * (the server only stores the numbers — see shared/avatar.ts).
 */
import type { Avatar as AvatarData } from "@shared/avatar";

const INK = "#231942";
export const BG = ["#FFD23F", "#0FA3B1", "#E4007C", "#FF8C42", "#6CBF43", "#8E7CC3"];
export const SKIN = ["#FFE3C8", "#F3C79E", "#E0A878", "#C68652", "#9A5E36", "#6B3E22"];
export const HAIR_COLOR = ["#1B1530", "#4A2C17", "#8B5A2B", "#D9A441", "#E8E1D3", "#B23A2B", "#2E5AAC", "#E4007C"];
export const EYE_COLOR = ["#2B1A0E", "#6B4423", "#2F7A45", "#2E5AAC", "#7A7A7A", "#0FA3B1"];

const HIJAB = 7;

function HairBack({ style, color }: { style: number; color: string }) {
  if (style === 4) return <path d="M24 46 Q24 18 50 18 Q76 18 76 46 L78 84 L22 84 Z" fill={color} stroke={INK} strokeWidth="2" />;
  if (style === HIJAB)
    return <path d="M20 54 Q18 16 50 15 Q82 16 80 54 Q82 76 92 100 L8 100 Q18 76 20 54 Z" fill={color} stroke={INK} strokeWidth="2" />;
  return null;
}

function HairFront({ style, color }: { style: number; color: string }) {
  const p = { fill: color, stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const };
  switch (style) {
    case 1: // short
    case 4: // long (front)
      return <path d="M27 46 Q26 20 50 20 Q74 20 73 46 Q70 33 50 32 Q31 33 27 46 Z" {...p} />;
    case 2: // spiky
      return <path d="M27 44 L28 26 L35 31 L39 18 L45 28 L50 16 L55 28 L61 18 L65 31 L72 26 L73 44 Q66 33 50 32 Q34 33 27 44 Z" {...p} />;
    case 3: // curly
      return (
        <g {...p}>
          {[[30, 36], [35, 27], [43, 22], [50, 21], [57, 22], [65, 27], [70, 36]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="7.5" />
          ))}
        </g>
      );
    case 5: // side part
      return <path d="M27 46 Q25 19 52 19 Q75 21 73 44 Q64 30 44 33 Q36 37 27 46 Z" {...p} />;
    case 6: // bun
      return (
        <g {...p}>
          <circle cx="50" cy="15" r="8" />
          <path d="M27 46 Q26 20 50 20 Q74 20 73 46 Q70 33 50 32 Q31 33 27 46 Z" />
        </g>
      );
    case HIJAB: // hijab front band
      return <path d="M27 44 Q28 24 50 24 Q72 24 73 44 Q70 30 50 29 Q30 30 27 44 Z" fill={color} stroke={INK} strokeWidth="1.5" opacity="0.9" />;
    case 8: // mohawk
      return <path d="M44 34 L44 14 Q50 8 56 14 L56 34 Q50 31 44 34 Z" {...p} />;
    default:
      return null;
  }
}

function Eyes({ style, color }: { style: number; color: string }) {
  const big = (x: number) => (
    <g key={x}>
      <circle cx={x} cy="48" r="5.2" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <circle cx={x} cy="48.5" r="3" fill={color} />
      <circle cx={x} cy="48.5" r="1.4" fill={INK} />
      <circle cx={x + 1.2} cy="47" r="0.9" fill="#fff" />
    </g>
  );
  switch (style) {
    case 1:
      return <>{[41, 59].map(big)}</>;
    case 2: // happy
      return <path d="M37 50 Q41 44 45 50 M55 50 Q59 44 63 50" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />;
    case 3: // sleepy
      return (
        <g>
          <path d="M36.5 48 Q41 52 45.5 48 Z M54.5 48 Q59 52 63.5 48 Z" fill={color} stroke={INK} strokeWidth="1.6" />
          <path d="M36 48 H46 M54 48 H64" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      );
    case 4: // wink
      return (
        <g>
          {big(41)}
          <path d="M55 49 Q59 45 63 49" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g fill={color} stroke={INK} strokeWidth="1">
          <circle cx="41" cy="48" r="2.8" />
          <circle cx="59" cy="48" r="2.8" />
        </g>
      );
  }
}

function Mouth({ style }: { style: number }) {
  const line = { fill: "none", stroke: INK, strokeWidth: 2.4, strokeLinecap: "round" as const };
  switch (style) {
    case 1: // grin
      return <path d="M40 60 Q50 72 60 60 Z" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
    case 2: // O
      return <ellipse cx="50" cy="63" rx="4.5" ry="5.5" fill="#7A1F3D" stroke={INK} strokeWidth="2" />;
    case 3: // smirk
      return <path d="M42 63 Q52 66 59 58" {...line} />;
    case 4: // flat
      return <path d="M43 63 H57" {...line} />;
    case 5: // tongue
      return (
        <g>
          <path d="M41 60 Q50 68 59 60" {...line} />
          <path d="M47 64 Q47 71 51 71 Q55 71 54 64 Z" fill="#F06292" stroke={INK} strokeWidth="1.6" />
        </g>
      );
    default:
      return <path d="M41 60 Q50 68 59 60" {...line} />;
  }
}

function Beard({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 1: // mustache
      return <path d="M41 58 Q46 54 50 57 Q54 54 59 58 Q54 60 50 58.5 Q46 60 41 58 Z" fill={color} stroke={INK} strokeWidth="1.4" />;
    case 2: // full beard
      return (
        <path
          d="M28 52 Q30 78 50 80 Q70 78 72 52 Q68 64 62 64 Q56 58 50 58 Q44 58 38 64 Q32 64 28 52 Z"
          fill={color}
          stroke={INK}
          strokeWidth="1.8"
        />
      );
    case 3: // stubble
      return <path d="M30 56 Q32 76 50 78 Q68 76 70 56 Q62 70 50 70 Q38 70 30 56 Z" fill={color} opacity="0.35" />;
    default:
      return null;
  }
}

function Glasses({ style }: { style: number }) {
  switch (style) {
    case 1:
      return (
        <g fill="none" stroke={INK} strokeWidth="2">
          <circle cx="41" cy="48" r="7" />
          <circle cx="59" cy="48" r="7" />
          <path d="M48 48 H52" />
        </g>
      );
    case 2:
      return (
        <g fill="none" stroke={INK} strokeWidth="2">
          <rect x="33" y="42.5" width="15" height="11" rx="2" />
          <rect x="52" y="42.5" width="15" height="11" rx="2" />
          <path d="M48 47 H52" />
        </g>
      );
    case 3:
      return (
        <g stroke={INK} strokeWidth="2">
          <rect x="32" y="42" width="16" height="11" rx="4" fill={INK} />
          <rect x="52" y="42" width="16" height="11" rx="4" fill={INK} />
          <path d="M48 46 H52" />
          <path d="M35 45 L39 45" stroke="#fff" strokeWidth="1.4" opacity="0.7" />
        </g>
      );
    default:
      return null;
  }
}

function Hat({ style }: { style: number }) {
  const s = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const };
  switch (style) {
    case 1: // cap
      return (
        <g {...s}>
          <path d="M27 34 Q28 14 50 14 Q72 14 73 34 Z" fill="#E4007C" />
          <path d="M52 32 Q72 30 86 36 Q72 38 52 36 Z" fill="#B0005F" />
        </g>
      );
    case 2: // tarboosh (Egyptian fez)
      return (
        <g {...s}>
          <path d="M34 30 L38 8 L62 8 L66 30 Q50 34 34 30 Z" fill="#C1272D" />
          <path d="M50 8 Q57 9 60 22" fill="none" stroke={INK} strokeWidth="2.2" />
          <circle cx="60" cy="23" r="2.4" fill={INK} />
        </g>
      );
    case 3: // crown
      return <path d="M32 30 L32 12 L41 21 L50 9 L59 21 L68 12 L68 30 Z" fill="#FFD23F" {...s} />;
    case 4: // beanie
      return (
        <g {...s}>
          <circle cx="50" cy="9" r="4.5" fill="#fff" />
          <path d="M27 34 Q27 12 50 12 Q73 12 73 34 Z" fill="#0FA3B1" />
          <rect x="26" y="29" width="48" height="7" rx="3" fill="#0B7E89" />
        </g>
      );
    default:
      return null;
  }
}

export function Avatar({ avatar, size = 40, className = "" }: { avatar: AvatarData; size?: number; className?: string }) {
  const a = avatar ?? ({} as AvatarData);
  const skin = SKIN[a.skin] ?? SKIN[2];
  const hairColor = HAIR_COLOR[a.hairColor] ?? HAIR_COLOR[0];
  const hijab = a.hair === HIJAB;
  return (
    <svg
      className={`avatar-svg ${className}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      <defs>
        <clipPath id="av-clip">
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill={BG[a.bg] ?? BG[0]} />
      <g clipPath="url(#av-clip)">
        <HairBack style={a.hair} color={hairColor} />
        {/* shoulders */}
        <path d="M16 100 Q18 80 50 78 Q82 80 84 100 Z" fill={INK} />
        <rect x="43" y="66" width="14" height="14" fill={skin} stroke={INK} strokeWidth="2" />
        {!hijab && (
          <g fill={skin} stroke={INK} strokeWidth="2">
            <circle cx="27" cy="51" r="5" />
            <circle cx="73" cy="51" r="5" />
          </g>
        )}
        <ellipse cx="50" cy="49" rx="23" ry="26" fill={skin} stroke={INK} strokeWidth="2" />
        <Beard style={a.beard} color={hairColor} />
        <Eyes style={a.eyes} color={EYE_COLOR[a.eyeColor] ?? EYE_COLOR[0]} />
        <path d="M49 52 Q47 57 51 57" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        <Mouth style={a.mouth} />
        <Glasses style={a.glasses} />
        <HairFront style={a.hair} color={hairColor} />
        <Hat style={a.hat} />
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke={INK} strokeWidth="3" />
    </svg>
  );
}
