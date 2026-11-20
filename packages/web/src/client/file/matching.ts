export interface Folded {
  readonly path: string
  readonly whole: string
  readonly name: string
}

const seen = new WeakMap<ReadonlyArray<string>, ReadonlyArray<Folded>>()

export const folded = (paths: ReadonlyArray<string>): ReadonlyArray<Folded> => {
  const before = seen.get(paths)
  if (before !== undefined) return before
  const now = paths.map((path) => {
    const whole = path.toLowerCase()
    return { path, whole, name: whole.slice(whole.lastIndexOf("/") + 1) }
  })
  seen.set(paths, now)
  return now
}

export const matchFiles = <File extends Folded>(
  files: ReadonlyArray<File>,
  query: string,
  limit: number,
): ReadonlyArray<File> => {
  const wanted = query.toLowerCase()
  const named: Array<File> = []
  const pathed: Array<File> = []
  const buried: Array<File> = []
  for (const file of files) {
    if (wanted === "" || file.name.startsWith(wanted)) named.push(file)
    else if (file.whole.startsWith(wanted)) {
      if (pathed.length < limit) pathed.push(file)
    } else if (file.whole.includes(wanted) && buried.length < limit) {
      buried.push(file)
    }
    if (named.length >= limit) break
  }
  return [...named, ...pathed, ...buried].slice(0, limit)
}

export const nameOf = (path: string): string =>
  path.slice(path.lastIndexOf("/") + 1)

export const dirOf = (path: string): string => {
  const cut = path.lastIndexOf("/")
  return cut === -1 ? "" : path.slice(0, cut)
}
