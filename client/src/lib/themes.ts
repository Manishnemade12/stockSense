export const THEMES = [
  {
    id: "midnight",
    name: "Midnight Indigo",
    description: "Deep navy with electric indigo — sophisticated tech feel.",
    swatches: ["#0a0a1a", "#141432", "#4f46e5", "#22d3ee"],
  },
  {
    id: "mint",
    name: "Neon Mint",
    description: "Dark base with bright mint accents — fresh startup energy.",
    swatches: ["#0d1b2a", "#1b4332", "#2dd4a8", "#73ffb8"],
  },
  {
    id: "sunset",
    name: "Sunset Blaze",
    description: "Warm orange to magenta — dynamic and attention-grabbing.",
    swatches: ["#faf8f5", "#ff6b35", "#f7931e", "#e84393"],
  },
  {
    id: "cloud",
    name: "Cloud White",
    description: "Crisp whites with blue accents — clean, airy SaaS look.",
    swatches: ["#fafbfc", "#e8ecf1", "#3b82f6", "#06b6d4"],
  },
  {
    id: "noir",
    name: "Noir & Gold",
    description: "Black with luxurious gold — high-end editorial feel.",
    swatches: ["#0d0d0d", "#1a1a1a", "#c9a84c", "#f0d78c"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "midnight";

export const THEME_STORAGE_KEY = "app-theme";
