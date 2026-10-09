/**
 * Original, hand-built SVG avatars. Each part is an index into the lists below
 * (the server only stores the numbers — see shared/avatar.ts).
 */
import type { Avatar as AvatarData } from "@shared/avatar";

const INK = "#231942";
export const BG = ["#FFD23F", "#0FA3B1", "#E4007C", "#FF8C42", "#6CBF43", "#8E7CC3", "#3D8BFF", "#F7F1E3"];
export const SKIN = ["#FFE3C8", "#F3C79E", "#E0A878", "#C68652", "#9A5E36", "#6B3E22", "#4A2A17"];
export const HAIR_COLOR = ["#1B1530", "#4A2C17", "#8B5A2B", "#D9A441", "#E8E1D3", "#B23A2B", "#2E5AAC", "#E4007C", "#6CBF43", "#FF8C42"];
export const EYE_COLOR = ["#2B1A0E", "#6B4423", "#2F7A45", "#2E5AAC", "#7A7A7A", "#0FA3B1", "#8E3FBF"];
export const SHIRT = ["#231942", "#E4007C", "#0FA3B1", "#FF8C42", "#F7F1E3", "#6CBF43", "#E63946", "#3D8BFF"];

const HIJAB = 7;
const line = { fill: "none", stroke: INK, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function HairBack({ style, color }: { style: number; color: string }) {
  const p = { fill: color, stroke: INK, strokeWidth: 2 };
  switch (style) {
    case 4: // long
      return <path d="M24 46 Q24 18 50 18 Q76 18 76 46 L78 84 L22 84 Z" {...p} />;
    case HIJAB:
      return <path d="M20 54 Q18 16 50 15 Q82 16 80 54 Q82 76 92 100 L8 100 Q18 76 20 54 Z" {...p} />;
    case 10: // ponytail
      return <path d="M70 34 Q90 40 84 66 Q80 76 74 70 Q80 54 68 44 Z" {...p} />;
    case 12: // wavy long
      return <path d="M24 44 Q20 18 50 17 Q80 18 76 44 Q84 58 76 70 Q82 80 72 88 L28 88 Q18 80 24 70 Q16 58 24 44 Z" {...p} />;
    case 9: // afro (big back volume)
      return <circle cx="50" cy="38" r="31" {...p} />;
    default:
      return null;
  }
}

function HairFront({ style, color }: { style: number; color: string }) {
  const p = { fill: color, stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const };
  const cap = "M27 46 Q26 20 50 20 Q74 20 73 46 Q70 33 50 32 Q31 33 27 46 Z";
  switch (style) {
    case 1:
    case 4:
    case 10:
      return <path d={cap} {...p} />;
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
          <path d={cap} />
        </g>
      );
    case HIJAB:
      return <path d="M27 44 Q28 24 50 24 Q72 24 73 44 Q70 30 50 29 Q30 30 27 44 Z" fill={color} stroke={INK} strokeWidth="1.5" opacity="0.9" />;
    case 8: // mohawk
      return <path d="M44 34 L44 14 Q50 8 56 14 L56 34 Q50 31 44 34 Z" {...p} />;
    case 9: // afro front fringe
      return <path d="M27 44 Q30 30 40 31 Q45 26 50 30 Q55 26 60 31 Q70 30 73 44 Q66 36 50 36 Q34 36 27 44 Z" {...p} />;
    case 11: // buzz cut
      return <path d="M28 42 Q28 22 50 22 Q72 22 72 42 Q66 31 50 30 Q34 31 28 42 Z" fill={color} opacity="0.55" />;
    case 12: // wavy long front
      return <path d="M27 48 Q24 20 50 19 Q76 20 73 48 Q68 34 58 34 Q54 40 48 34 Q40 40 36 34 Q30 38 27 48 Z" {...p} />;
    case 13: // fringe / bangs
      return <path d="M27 46 Q26 18 50 18 Q74 18 73 46 Q72 40 70 38 L30 38 Q28 40 27 46 Z" {...p} />;
    default:
      return null;
  }
}

function Brows({ style, color }: { style: number; color: string }) {
  const b = { ...line, stroke: color === "#E8E1D3" ? INK : color, strokeWidth: 2.6 };
  switch (style) {
    case 1:
      return <path d="M36 40 Q41 37 46 40 M54 40 Q59 37 64 40" {...b} />;
    case 2: // raised
      return <path d="M36 37 Q41 32 46 37 M54 37 Q59 32 64 37" {...b} />;
    case 3: // angry
      return <path d="M36 37 L46 41 M64 37 L54 41" {...b} />;
    case 4: // thick unibrow
      return <path d="M35 40 Q42 36 50 39 Q58 36 65 40" {...b} strokeWidth={4} />;
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
  const heart = (x: number) => (
    <path key={x} d={`M${x} 52 L${x - 4.5} 47.5 Q${x - 4.5} 44 ${x - 2} 44 Q${x} 44 ${x} 46.5 Q${x} 44 ${x + 2} 44 Q${x + 4.5} 44 ${x + 4.5} 47.5 Z`} fill="#E63946" stroke={INK} strokeWidth="1.2" />
  );
  switch (style) {
    case 1:
      return <>{[41, 59].map(big)}</>;
    case 2: // happy
      return <path d="M37 50 Q41 44 45 50 M55 50 Q59 44 63 50" {...line} />;
    case 3: // sleepy
      return (
        <g>
          <path d="M36.5 48 Q41 52 45.5 48 Z M54.5 48 Q59 52 63.5 48 Z" fill={color} stroke={INK} strokeWidth="1.6" />
          <path d="M36 48 H46 M54 48 H64" {...line} />
        </g>
      );
    case 4: // wink
      return (
        <g>
          {big(41)}
          <path d="M55 49 Q59 45 63 49" {...line} />
        </g>
      );
    case 5: // side-eye
      return (
        <g>
          {[41, 59].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="48" rx="5.5" ry="3.6" fill="#fff" stroke={INK} strokeWidth="1.6" />
              <circle cx={x - 2.4} cy="48" r="2.2" fill={color} />
            </g>
          ))}
        </g>
      );
    case 6: // laughing > <
      return <path d="M37 45 L44 48 L37 51 M63 45 L56 48 L63 51" {...line} />;
    case 7:
      return <>{[41, 59].map(heart)}</>;
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
    case 6: // shocked
      return <path d="M42 60 Q50 56 58 60 Q60 70 50 71 Q40 70 42 60 Z" fill="#7A1F3D" stroke={INK} strokeWidth="2" />;
    case 7: // big laugh
      return (
        <g>
          <path d="M38 59 Q50 76 62 59 Z" fill="#7A1F3D" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M40 60 H60 L58 63 H42 Z" fill="#fff" />
        </g>
      );
    case 8: // sad
      return <path d="M42 65 Q50 58 58 65" {...line} />;
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
    case 4: // goatee
      return <path d="M44 67 Q50 64 56 67 Q56 76 50 78 Q44 76 44 67 Z" fill={color} stroke={INK} strokeWidth="1.5" />;
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
    case 4: // star shades
      return (
        <g stroke={INK} strokeWidth="1.6" fill="#E4007C">
          <path d="M41 41 L43 46 L48 46 L44 49 L46 54 L41 51 L36 54 L38 49 L34 46 L39 46 Z" />
          <path d="M59 41 L61 46 L66 46 L62 49 L64 54 L59 51 L54 54 L56 49 L52 46 L57 46 Z" />
          <path d="M48 47 H52" fill="none" />
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
    case 5: // headphones
      return (
        <g {...s}>
          <path d="M24 50 Q22 14 50 14 Q78 14 76 50" fill="none" strokeWidth="4" />
          <rect x="18" y="44" width="10" height="16" rx="4" fill="#E63946" />
          <rect x="72" y="44" width="10" height="16" rx="4" fill="#E63946" />
        </g>
      );
    case 6: // graduation cap
      return (
        <g {...s}>
          <path d="M32 26 Q50 32 68 26 L68 18 L32 18 Z" fill={INK} />
          <path d="M18 16 L50 6 L82 16 L50 26 Z" fill={INK} />
          <path d="M74 18 L76 34" stroke="#FFD23F" strokeWidth="2" />
          <circle cx="76" cy="35" r="2.5" fill="#FFD23F" stroke="none" />
        </g>
      );
    case 7: // kufi / taqiyah
      return <path d="M30 32 Q30 12 50 12 Q70 12 70 32 Q50 28 30 32 Z" fill="#F7F1E3" {...s} />;
    default:
      return null;
  }
}

function Extra({ style }: { style: number }) {
  switch (style) {
    case 1: // blush
      return (
        <g fill="#FF6B8B" opacity="0.45">
          <ellipse cx="34" cy="57" rx="5" ry="3" />
          <ellipse cx="66" cy="57" rx="5" ry="3" />
        </g>
      );
    case 2: // freckles
      return (
        <g fill="#8B5A2B" opacity="0.7">
          {[[34, 55], [37, 58], [31, 58], [66, 55], [63, 58], [69, 58]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.9" />
          ))}
        </g>
      );
    case 3: // sweat drop
      return <path d="M71 34 Q75 41 71 44 Q67 41 71 34 Z" fill="#9ED8F5" stroke={INK} strokeWidth="1.3" />;
    case 4: // mole
      return <circle cx="61" cy="62" r="1.4" fill={INK} />;
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
    <svg className={`avatar-svg ${className}`} viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <clipPath id="av-clip">
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill={BG[a.bg] ?? BG[0]} />
      <g clipPath="url(#av-clip)">
        <HairBack style={a.hair} color={hairColor} />
        <path d="M14 100 Q16 79 50 77 Q84 79 86 100 Z" fill={SHIRT[a.shirt] ?? SHIRT[0]} stroke={INK} strokeWidth="2" />
        <rect x="43" y="66" width="14" height="13" fill={skin} stroke={INK} strokeWidth="2" />
        {!hijab && (
          <g fill={skin} stroke={INK} strokeWidth="2">
            <circle cx="27" cy="51" r="5" />
            <circle cx="73" cy="51" r="5" />
          </g>
        )}
        <ellipse cx="50" cy="49" rx="23" ry="26" fill={skin} stroke={INK} strokeWidth="2" />
        <Extra style={a.extra} />
        <Beard style={a.beard} color={hairColor} />
        <Brows style={a.eyebrows} color={hairColor} />
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
