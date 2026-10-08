// Generates the original placeholder meme templates (SVG) + templates.json.
// Run once: node scripts/make-placeholder-templates.mjs
// Replace these with real Egyptian meme images whenever you like.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const scenes = [
  { id: "sample_001", name: "قاعد على القهوة", cats: ["Egyptian", "Everyday Life"], bg: "#FFB703", floor: "#8D5524", emoji: ["🧔", "☕", "🪑"], pos: "top" },
  { id: "sample_002", name: "التليفون بيرن", cats: ["Everyday Life", "Family"], bg: "#8ECAE6", floor: "#219EBC", emoji: ["😰", "📱"], pos: "bottom" },
  { id: "sample_003", name: "الامتحان بكرة", cats: ["University"], bg: "#F4A261", floor: "#6D597A", emoji: ["😵‍💫", "📚", "🕑"], pos: "top" },
  { id: "sample_004", name: "الماتش في الوقت الضايع", cats: ["Football"], bg: "#2A9D8F", floor: "#1B4332", emoji: ["😱", "📺", "⚽"], pos: "bottom" },
  { id: "sample_005", name: "ماما بتنادي من المطبخ", cats: ["Family"], bg: "#FFAFCC", floor: "#B5838D", emoji: ["👩‍🍳", "🥘", "🗣️"], pos: "top" },
  { id: "sample_006", name: "آخر ساعة يوم الخميس", cats: ["Work"], bg: "#CDB4DB", floor: "#5E548E", emoji: ["😴", "💼", "🕔"], pos: "bottom" },
  { id: "sample_007", name: "الميكروباص الكامل", cats: ["Egyptian", "Everyday Life"], bg: "#FFD166", floor: "#555B6E", emoji: ["🚐", "🙋‍♂️", "🙋‍♀️"], pos: "top" },
  { id: "sample_008", name: "القطة اللي شايفة كل حاجة", cats: ["Random"], bg: "#E9EDC9", floor: "#A3B18A", emoji: ["😼", "👀"], pos: "bottom" },
  { id: "sample_009", name: "النت فصل", cats: ["Social Media"], bg: "#90E0EF", floor: "#0077B6", emoji: ["😤", "📶", "❌"], pos: "top" },
  { id: "sample_010", name: "الفرح الشعبي", cats: ["Egyptian"], bg: "#FF5D8F", floor: "#7B2CBF", emoji: ["💃", "🎤", "🎉"], pos: "bottom" },
  { id: "sample_011", name: "سين ومردش", cats: ["Relationships", "Social Media"], bg: "#BDE0FE", floor: "#4361EE", emoji: ["🙂", "💬", "👀"], pos: "top" },
  { id: "sample_012", name: "طبق الكشري", cats: ["Egyptian", "Everyday Life"], bg: "#FEC89A", floor: "#9C6644", emoji: ["🤤", "🍲", "🌶️"], pos: "bottom" },
];

function svg(s) {
  const n = s.emoji.length;
  const items = s.emoji
    .map((e, i) => {
      const x = (800 / (n + 1)) * (i + 1);
      const size = i === 0 ? 210 : 150;
      const y = i === 0 ? 400 : 420;
      return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="middle">${e}</text>`;
    })
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="${s.bg}"/>
  <circle cx="680" cy="120" r="70" fill="#ffffff" opacity="0.35"/>
  <circle cx="120" cy="90" r="40" fill="#ffffff" opacity="0.25"/>
  <rect y="470" width="800" height="130" fill="${s.floor}"/>
  <rect y="470" width="800" height="10" fill="#000000" opacity="0.12"/>
  ${items}
  <g transform="translate(16 ${s.pos === "top" ? 556 : 16})">
    <rect width="150" height="30" rx="6" fill="#1B1530" opacity="0.75"/>
    <text x="75" y="20" font-size="15" fill="#fff" text-anchor="middle" font-family="sans-serif">قالب تجريبي</text>
  </g>
</svg>
`;
}

for (const s of scenes) {
  writeFileSync(join(root, "client/public/templates", `${s.id}.svg`), svg(s));
}

const json = {
  $comment:
    "Add a meme: put the image in client/public/templates/ and add an entry here. categories: Egyptian, Arabic, TV, Movies, Football, University, Work, Relationships, Family, Everyday Life, Social Media, Random. captionPosition: top | bottom. enabled: false hides it.",
  templates: scenes.map((s) => ({
    id: s.id,
    image: `/templates/${s.id}.svg`,
    name: s.name,
    categories: s.cats,
    captionPosition: s.pos,
    enabled: true,
  })),
};
writeFileSync(join(root, "shared/templates.json"), JSON.stringify(json, null, 2) + "\n");
console.log(`Wrote ${scenes.length} templates`);
