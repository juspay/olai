export type SizeName = "medium" | "large" | "larger"

export interface TypeSize {
  readonly name: SizeName
  readonly label: string
  /* On the root element a `rem` means the INITIAL value of `font-size` — the
   * browser's own, or the reader's preference — rather than the value being
   * declared (css-values-4 §5.1.1), so these are multipliers of that baseline
   * and not pixel counts overriding it. */
  readonly root: string
  readonly hint: string
}

export const SIZES: ReadonlyArray<TypeSize> = [
  {
    name: "medium",
    label: "Medium",
    root: "1rem",
    hint: "Your browser's own text size.",
  },
  {
    name: "large",
    label: "Large",
    root: "1.125rem",
    hint: "One notch up from your browser's size. olai's default.",
  },
  {
    name: "larger",
    label: "Larger",
    root: "1.25rem",
    hint: "Two notches up. The whole page scales with it.",
  },
]

export const DEFAULT_SIZE: SizeName = "large"

export const SIZE_ATTRIBUTE = "data-size"

export const SIZE_STORAGE_KEY = "olai.size"

export const sizeNamed = (name: string | null): TypeSize | undefined =>
  SIZES.find((one) => one.name === name)

export const DEFAULT_TYPE_SIZE: TypeSize = (() => {
  const size = sizeNamed(DEFAULT_SIZE)
  if (size === undefined) {
    throw new Error(`unreachable: no row named ${DEFAULT_SIZE}`)
  }
  return size
})()

export const sizeCss = (): string =>
  SIZES
    .map((size) => {
      const named = `:root[${SIZE_ATTRIBUTE}="${size.name}"]`
      const selector = size.name === DEFAULT_SIZE ? `:root, ${named}` : named
      return `${selector} {\n  font-size: ${size.root};\n}`
    })
    .join("\n\n")
