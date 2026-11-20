export interface Line {
  readonly kind: "same" | "del" | "add"
  readonly text: string
}

const LIMIT = 400

export const diffLines = (before: string, after: string): ReadonlyArray<Line> => {
  const left = before === "" ? [] : before.replace(/\n$/, "").split("\n")
  const right = after === "" ? [] : after.replace(/\n$/, "").split("\n")
  let head = 0
  while (head < left.length && head < right.length && left[head] === right[head]) head += 1
  let tail = 0
  while (
    tail < left.length - head
    && tail < right.length - head
    && left[left.length - 1 - tail] === right[right.length - 1 - tail]
  ) tail += 1
  const from = left.slice(head, left.length - tail)
  const to = right.slice(head, right.length - tail)
  const middle = from.length + to.length > LIMIT
    ? [...from.map((text): Line => ({ kind: "del", text })), ...to.map((text): Line => ({ kind: "add", text }))]
    : walk(from, to)
  return [
    ...left.slice(0, head).map((text): Line => ({ kind: "same", text })),
    ...middle,
    ...left.slice(left.length - tail).map((text): Line => ({ kind: "same", text })),
  ]
}

const walk = (from: ReadonlyArray<string>, to: ReadonlyArray<string>): ReadonlyArray<Line> => {
  const width = to.length + 1
  const lengths = new Uint32Array((from.length + 1) * width)
  for (let a = from.length - 1; a >= 0; a -= 1) {
    for (let b = to.length - 1; b >= 0; b -= 1) {
      lengths[a * width + b] = from[a] === to[b]
        ? lengths[(a + 1) * width + b + 1]! + 1
        : Math.max(lengths[(a + 1) * width + b]!, lengths[a * width + b + 1]!)
    }
  }
  const lines: Line[] = []
  let a = 0
  let b = 0
  while (a < from.length && b < to.length) {
    if (from[a] === to[b]) { lines.push({ kind: "same", text: from[a]! }); a += 1; b += 1 }
    else if (lengths[(a + 1) * width + b]! >= lengths[a * width + b + 1]!) { lines.push({ kind: "del", text: from[a]! }); a += 1 }
    else { lines.push({ kind: "add", text: to[b]! }); b += 1 }
  }
  for (; a < from.length; a += 1) lines.push({ kind: "del", text: from[a]! })
  for (; b < to.length; b += 1) lines.push({ kind: "add", text: to[b]! })
  return lines
}

export const changedCount = (lines: ReadonlyArray<Line>): number => {
  let total = 0
  let dels = 0
  let adds = 0
  const settle = () => { total += Math.max(dels, adds); dels = 0; adds = 0 }
  for (const line of lines) {
    if (line.kind === "same") settle()
    else if (line.kind === "del") dels += 1
    else adds += 1
  }
  settle()
  return total
}
