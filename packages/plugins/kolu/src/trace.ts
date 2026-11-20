export type Fact = string | number | boolean | null

/**
 * The order is the CALLER'S and is never sorted.
 */
export type Trace = (moment: string, facts: Readonly<Record<string, Fact>>) => void

const PREFIX = "kolu doorbell"

const tokenOf = (fact: Fact): string => {
  if (fact === null) return "none"
  if (typeof fact !== "string") return String(fact)
  return fact !== "" && !/[\s"=]/.test(fact) ? fact : JSON.stringify(fact)
}

export const tracing = (say: (line: string) => void): Trace => (moment, facts) => {
  let line = `${PREFIX} ${moment}`
  for (const [key, fact] of Object.entries(facts)) line += ` ${key}=${tokenOf(fact)}`
  say(line)
}

export const listed = (entries: Iterable<string>): Fact => {
  const all = [...entries]
  return all.length === 0 ? null : all.join(",")
}
