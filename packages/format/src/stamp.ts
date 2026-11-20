const pad = (value: number, width = 2): string => String(value).padStart(width, "0")

export const offsetOf = (minutes: number): string => {
  const east = -minutes
  const size = Math.abs(east)
  return `${east < 0 ? "-" : "+"}${pad(Math.trunc(size / 60))}:${pad(size % 60)}`
}

export const stampOf = (at: Date): string =>
  `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
  `T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}` +
  offsetOf(at.getTimezoneOffset())
