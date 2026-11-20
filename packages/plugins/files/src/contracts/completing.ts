import { bareOf, type Claim, type Claims, mintExt, fileKind } from "@olai/format"

const oneNamed = (claims: Claims, kind: Claim["kind"]): string => {
  const claim = claims.byKind.get(kind)
  return claim === undefined ? "a file" : `${claim.article} ${claim.noun}`
}

const NOT_A_NAME: ReadonlySet<string> = new Set(["", ".", ".."])

export type Meant =
  | { readonly file: string }
  | { readonly refused: string }
  | null

export const meantAt = (claims: Claims, of: Claim["kind"], typed: string): Meant => {
  const name = typed.trim()
  if (name === "") return null
  const ext = mintExt(claims, of)
  if (ext === null) return { refused: `Creating ${of} files is turned off.` }
  const carried = fileKind(claims, name)
  if (carried === of) return { file: name }
  if (carried === null) {
    const last = name.slice(name.lastIndexOf("/") + 1)
    return { file: NOT_A_NAME.has(last) ? name : `${name}${ext}` }
  }
  const bare = bareOf(claims, name)
  const said = `\`${name}\` is ${oneNamed(claims, carried)}, not ${oneNamed(claims, of)}`
  const advice = bare === "" ? "" : ` — type \`${bare}\` to make \`${bare}${ext}\``
  return { refused: `${said}${advice}.` }
}
