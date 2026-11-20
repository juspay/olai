export interface DiffLine {
  readonly kind: "same" | "add" | "remove" | "gap"
  readonly text: string
  readonly before: number | null
  readonly after: number | null
  readonly hidden: number
}

export interface Diff {
  readonly lines: ReadonlyArray<DiffLine>
  readonly added: number
  readonly removed: number
  readonly created: boolean
  readonly wholesale: boolean
}

const CONTEXT = 2

const CELLS = 250_000

export const diffOf = (before: string | null, after: string): Diff => {
  const was = linesIn(before ?? "")
  const now = linesIn(after)
  const compared = compare(was, now)
  const lines = withGaps(compared.lines)
  let added = 0
  let removed = 0
  for (const line of lines) {
    if (line.kind === "add") added++
    else if (line.kind === "remove") removed++
  }
  return { lines, added, removed, created: before === null, wholesale: compared.wholesale }
}

export const linesIn = (text: string): ReadonlyArray<string> => {
  if (text === "") return []
  const lines = text.split("\n")
  if (lines[lines.length - 1] === "") lines.pop()
  return lines
}

const compare = (
  was: ReadonlyArray<string>,
  now: ReadonlyArray<string>,
): { readonly lines: ReadonlyArray<DiffLine>; readonly wholesale: boolean } => {
  const lines: Array<DiffLine> = []
  let head = 0
  while (head < was.length && head < now.length && was[head] === now[head]) {
    lines.push(same(was[head]!, head + 1, head + 1))
    head++
  }
  let tail = 0
  while (
    tail < was.length - head && tail < now.length - head &&
    was[was.length - 1 - tail] === now[now.length - 1 - tail]
  ) {
    tail++
  }

  const middleWas = was.slice(head, was.length - tail)
  const middleNow = now.slice(head, now.length - tail)
  const wholesale = middleWas.length * middleNow.length > CELLS
  let i = 0
  let j = 0
  for (const step of steps(middleWas, middleNow, wholesale)) {
    if (step === "same") {
      lines.push(same(middleWas[i]!, head + i + 1, head + j + 1))
      i++
      j++
    } else if (step === "remove") {
      lines.push(gone(middleWas[i]!, head + i + 1))
      i++
    } else {
      lines.push(arrived(middleNow[j]!, head + j + 1))
      j++
    }
  }

  for (let back = tail; back > 0; back--) {
    lines.push(same(was[was.length - back]!, was.length - back + 1, now.length - back + 1))
  }
  return { lines, wholesale }
}

const same = (text: string, before: number, after: number): DiffLine => ({
  kind: "same",
  text,
  before,
  after,
  hidden: 0,
})

const gone = (text: string, before: number): DiffLine => ({
  kind: "remove",
  text,
  before,
  after: null,
  hidden: 0,
})

const arrived = (text: string, after: number): DiffLine => ({
  kind: "add",
  text,
  before: null,
  after,
  hidden: 0,
})

const steps = (
  was: ReadonlyArray<string>,
  now: ReadonlyArray<string>,
  wholesale: boolean,
): ReadonlyArray<"same" | "add" | "remove"> => {
  if (wholesale) {
    return [...was.map(() => "remove" as const), ...now.map(() => "add" as const)]
  }

  const table: Array<Array<number>> = Array.from(
    { length: was.length + 1 },
    () => new Array<number>(now.length + 1).fill(0),
  )
  for (let i = was.length - 1; i >= 0; i--) {
    for (let j = now.length - 1; j >= 0; j--) {
      table[i]![j] = was[i] === now[j]
        ? table[i + 1]![j + 1]! + 1
        : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
    }
  }

  const walked: Array<"same" | "add" | "remove"> = []
  let i = 0
  let j = 0
  while (i < was.length && j < now.length) {
    if (was[i] === now[j]) {
      walked.push("same")
      i++
      j++
      continue
    }
    if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      walked.push("remove")
      i++
    } else {
      walked.push("add")
      j++
    }
  }
  while (i++ < was.length) walked.push("remove")
  while (j++ < now.length) walked.push("add")
  return walked
}

const withGaps = (lines: ReadonlyArray<DiffLine>): ReadonlyArray<DiffLine> => {
  const kept: Array<DiffLine> = []
  let run: Array<DiffLine> = []
  const flush = (leading: boolean, trailing: boolean) => {
    const head = leading ? 0 : CONTEXT
    const tail = trailing ? 0 : CONTEXT
    if (run.length <= head + tail + 1) {
      kept.push(...run)
    } else {
      if (!leading) kept.push(...run.slice(0, CONTEXT))
      kept.push({
        kind: "gap",
        text: "",
        before: null,
        after: null,
        hidden: run.length - head - tail,
      })
      if (!trailing) kept.push(...run.slice(run.length - CONTEXT))
    }
    run = []
  }

  let started = false
  for (const line of lines) {
    if (line.kind === "same") {
      run.push(line)
      continue
    }
    if (run.length > 0) flush(!started, false)
    started = true
    kept.push(line)
  }
  if (run.length > 0) flush(!started, true)
  return kept
}
