export const inkOf = (hue: string): string => INK[hue] ?? "text-muted"

const INK: Record<string, string> = {
  grey: "text-muted",
  amber: "text-doing",
  green: "text-done",
  red: "text-alarm",
  violet: "text-accent",
}
