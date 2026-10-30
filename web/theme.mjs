// Theme defaults coordinate the composition; element overrides stay independent.
export const THEMES = {
  blue: { title: "#8dc4ed", project: "#c1e9ff", subtitle: "#bac9dc", background: "#111b29", accent: "#8dc4ed" },
  orange: { title: "#ffbe78", project: "#ffe0b3", subtitle: "#d8c6bc", background: "#281b24", accent: "#efb16b" },
  green: { title: "#a5e2b9", project: "#d4f5b2", subtitle: "#b8cfc5", background: "#132826", accent: "#91cbb1" },
};
export const ELEMENTS = ["project", "title", "subtitle"];
export function elementStyle(banner, element) {
  const size = element === "title" ? 60 : 21;
  const color = banner.elementStyles === undefined && element !== "subtitle"
    ? banner.accent : (THEMES[banner.palette] || THEMES.blue)[element];
  return { color, size, face: element === "title" ? "display" : "plain", ...banner.elementStyles?.[element] };
}
export function applyTheme(banner, palette) {
  const theme = THEMES[palette];
  banner.palette = palette;
  banner.accent = theme.accent;
  banner.background = theme.background;
}
