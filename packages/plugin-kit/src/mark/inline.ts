export const MARK_TOKEN = "__MARK__"

const ID_SHAPE = /^[A-Za-z][A-Za-z0-9_-]*$/

const ID_ATTR = /\sid\s*=\s*(["'])(.*?)\1/g

const ANY_ATTR = /\s[A-Za-z_:][\w.:-]*\s*=\s*(["'])(.*?)\1/g

const DRAWS = /<(rect|path|circle|ellipse|polygon|polyline|line|use|g|image|text)\b/

const HEX = /^#[0-9A-Fa-f]{3,8}$/

function refuse(source: string, what: string): never {
  throw new Error(`${source}: ${what}`)
}

const bodyOf = (svg: string, source: string): { readonly viewBox: string; readonly body: string } => {
  const open = /<svg\b[^>]*>/.exec(svg)
  if (open === null) refuse(source, "has no root <svg> element")
  const openTag = open[0]
  const close = svg.lastIndexOf("</svg>")
  if (close < open.index + openTag.length) {
    refuse(source, "has no closing </svg> for its root element")
  }
  const viewBox = (/\sviewBox\s*=\s*"([^"]*)"/.exec(openTag)?.[1] ?? "").trim()
  if (viewBox === "") {
    refuse(source, "root <svg> has no viewBox — the nested viewport has nothing to fit the artwork into")
  }
  return { viewBox, body: svg.slice(open.index + openTag.length, close) }
}

// A fixpoint, and then a refusal: removing a match splices what is on either
// side of it, so two halves can close up into a delimiter that was not there
// before — `<!-<!-- -->-` is one match and taking it leaves `<!--` — and
// HTML's comment-end-bang state accepts `--!>` as a close as well as `-->`.
const withoutComments = (body: string, source: string): string => {
  let stripped = body
  for (let before = ""; before !== stripped;) {
    before = stripped
    stripped = stripped.replace(/<!--[\s\S]*?--!?>/g, "")
  }
  const bogus = /<[!?]|--!?>/.exec(stripped)
  if (bogus !== null) {
    refuse(source, `still carries ${bogus[0]} after the comments were taken out`)
  }
  return stripped
}

const withoutProse = (body: string): string =>
  body
    .replace(/<title\b[^>]*\/>/g, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, "")
    .replace(/<desc\b[^>]*\/>/g, "")
    .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/g, "")

const refuseConstructs = (body: string, source: string): void => {
  if (/<script\b/i.test(body)) refuse(source, "contains a <script> element")
  if (/<style\b/i.test(body)) {
    refuse(source, "contains a <style> element, whose selectors reference ids this rewrite cannot see")
  }
  if (/<foreignObject\b/i.test(body)) refuse(source, "contains a <foreignObject> element")
  const handler = /\son[a-z]+\s*=/i.exec(body)
  if (handler !== null) refuse(source, `contains an inline event handler (${handler[0].trim()})`)
  for (const link of body.matchAll(/\s(?:xlink:)?href\s*=\s*(["'])(.*?)\1/g)) {
    const value = link[2] ?? ""
    if (!value.startsWith("#")) {
      refuse(source, `references ${value} outside the document — a mark may only point at its own ids`)
    }
  }
}

const declaredIn = (body: string, source: string): ReadonlySet<string> => {
  const declared = new Set<string>()
  for (const found of body.matchAll(ID_ATTR)) {
    const id = found[2] ?? ""
    if (!ID_SHAPE.test(id)) {
      refuse(source, `declares the id "${id}", which is not a plain XML name this rewrite can prefix`)
    }
    if (declared.has(id)) refuse(source, `declares the id "${id}" twice`)
    declared.add(id)
  }
  return declared
}

const tokenised = (body: string, declared: ReadonlySet<string>, source: string): string => {
  const known = (id: string): string => {
    if (!declared.has(id)) refuse(source, `references #${id}, which it does not declare`)
    return id
  }
  return body
    .replace(
      /(\sid\s*=\s*)(["'])(.*?)\2/g,
      (_whole: string, before: string, quote: string, id: string) =>
        `${before}${quote}${MARK_TOKEN}${id}${quote}`,
    )
    .replace(
      /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g,
      (_whole: string, quote: string, id: string) => `url(${quote}#${MARK_TOKEN}${known(id)}${quote})`,
    )
    .replace(
      /(\s(?:xlink:)?href\s*=\s*)(["'])#(.*?)\2/g,
      (_whole: string, before: string, quote: string, id: string) =>
        `${before}${quote}#${MARK_TOKEN}${known(id)}${quote}`,
    )
}

const verifyRewrite = (body: string, declaredCount: number, source: string): void => {
  for (const found of body.matchAll(ID_ATTR)) {
    const id = found[2] ?? ""
    if (!id.startsWith(MARK_TOKEN)) refuse(source, `left the id "${id}" untokenised`)
  }
  const rewrittenCount = [...body.matchAll(ID_ATTR)].length
  if (rewrittenCount !== declaredCount) {
    refuse(source, `declared ${declaredCount} ids and emitted ${rewrittenCount} — the rewrite lost one`)
  }
  for (const token of [...body.matchAll(ANY_ATTR)].flatMap((attr) =>
    [...(attr[2] ?? "").matchAll(/#[^\s"'()<>,;]*/g)]
  )) {
    const text = token[0]
    if (text.startsWith(`#${MARK_TOKEN}`) || HEX.test(text)) continue
    refuse(source, `leaves the reference ${text}, which is neither a tokenised id nor a hex colour`)
  }
  if (!DRAWS.test(body)) {
    refuse(source, "has no drawing element left after the rewrite — the mark would be an empty box")
  }
}

export const inlineMark = (
  svg: string,
  source: string,
): { readonly viewBox: string; readonly body: string } => {
  if (svg.includes(MARK_TOKEN)) {
    refuse(source, `already contains the sentinel ${MARK_TOKEN}, which this transform needs to be its own`)
  }
  const { viewBox, body: raw } = bodyOf(svg, source)
  const stripped = withoutProse(withoutComments(raw, source))
  refuseConstructs(stripped, source)
  const declared = declaredIn(stripped, source)
  const body = tokenised(stripped, declared, source)
  verifyRewrite(body, declared.size, source)
  return { viewBox, body: body.trim() }
}
