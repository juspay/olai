export const AA = 4.5

const hexDigits = (hex: string): string => {
  const match = /^#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/.exec(hex)
  if (match?.[1] === undefined) throw new Error(`not a #RRGGBB colour: ${hex}`)
  return match[1]
}

const channel = (digits: string, at: number): number => {
  const unit = Number.parseInt(digits.slice(at, at + 2), 16) / 255
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

export const relativeLuminance = (hex: string): number => {
  const digits = hexDigits(hex)
  return (
    0.2126 * channel(digits, 0) +
    0.7152 * channel(digits, 2) +
    0.0722 * channel(digits, 4)
  )
}

export const contrastRatio = (
  foreground: string,
  background: string,
): number => {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
