// Source unique de verite pour l'emoji associe a une activite / un jeu du catalogue.
// Utilise partout (carte, fiche etablissement, Explorer) pour rester coherent.
// -> Pour ajouter un nouveau jeu : une seule ligne a ajouter ici.

// Normalise un libelle : minuscules, sans accents, sans espaces ni ponctuation.
// "Palet breton" -> "paletbreton" ; "Jeux d'adresse de comptoir" -> "jeuxdadressedecomptoir"
function normalizeKey(name: string): string {
  // .normalize("NFD") decompose les accents (ex: "é" -> "e" + diacritique combinant).
  // Ensuite /[^a-z0-9]/g retire d'un coup les diacritiques, espaces, tirets, apostrophes et slashs.
  return name
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Emoji officiel par jeu du catalogue (cle = nom normalise).
const EMOJI_BY_GAME: Record<string, string> = {
  airhockey: "🏒",
  arcade: "🕹️",
  babyfoot: "⚽",
  basket: "🏀",
  beerpong: "🍺",
  billard: "🎱",
  bowling: "🎳",
  cornhole: "🌽",
  escalade: "🧗",
  experiencesimulationvr: "🥽",
  flechettes: "🎯",
  flipper: "🕹️",
  jeudelagrenouille: "🐸",
  jeuxdadressedecomptoir: "🍻",
  jeuxdesociete: "🎲",
  jeuxvideos: "🎮",
  karting: "🏎️",
  lancerdehaches: "🪓",
  lasergame: "🔫",
  minigolf: "⛳",
  molkky: "🎳",
  padel: "🎾",
  paletbreton: "🥏",
  paletvendeen: "🥏",
  patinoire: "⛸️",
  petanque: "⚪",
  punchingball: "🥊",
  quizzroom: "🧠",
  retrogaming: "👾",
  shuffleboard: "🥌",
  simulateurdeconduite: "🚗",
  tennisdetable: "🏓",
  trampoline: "🤸",
};

// Correspondances partielles (robustes aux variantes / libelles non catalogues).
// L'ordre compte : les regles les plus specifiques d'abord.
const PARTIAL_RULES: { match: string[]; emoji: string }[] = [
  { match: ["palet"], emoji: "🥏" },
  { match: ["flechette", "dart"], emoji: "🎯" },
  { match: ["petanque", "boule"], emoji: "⚪" },
  { match: ["billard", "pool"], emoji: "🎱" },
  { match: ["babyfoot", "foosball"], emoji: "⚽" },
  { match: ["bowling"], emoji: "🎳" },
  { match: ["beerpong"], emoji: "🍺" },
  { match: ["hache", "axe"], emoji: "🪓" },
  { match: ["karaok"], emoji: "🎤" },
  { match: ["blind", "quiz"], emoji: "🧠" },
  { match: ["pingpong", "tennisdetable"], emoji: "🏓" },
  { match: ["padel", "tennis"], emoji: "🎾" },
  { match: ["basket"], emoji: "🏀" },
  { match: ["laser"], emoji: "🔫" },
  { match: ["karting", "conduite"], emoji: "🏎️" },
  { match: ["escalad"], emoji: "🧗" },
  { match: ["trampoline"], emoji: "🤸" },
  { match: ["golf"], emoji: "⛳" },
  { match: ["jeuxvideo", "console", "gaming"], emoji: "🎮" },
  { match: ["arcade", "flipper", "retrogam"], emoji: "🕹️" },
  { match: ["vr", "virtuel"], emoji: "🥽" },
  { match: ["jeu", "societe"], emoji: "🎲" },
];

/** Emoji a afficher pour une activite / un jeu. 🎮 en dernier recours. */
export function getActivityEmoji(name: string | null | undefined): string {
  if (!name) return "🎮";
  const key = normalizeKey(name);
  if (EMOJI_BY_GAME[key]) return EMOJI_BY_GAME[key];
  for (const rule of PARTIAL_RULES) {
    if (rule.match.some((m) => key.includes(m))) return rule.emoji;
  }
  return "🎮";
}
