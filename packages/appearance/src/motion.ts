export const motionIsReduced = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

export const scrollManner = (): ScrollBehavior => (motionIsReduced() ? "auto" : "smooth")
