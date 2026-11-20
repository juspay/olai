export const MARK_TOKEN = "__MARK__"

const ID_SHAPE = /^[A-Za-z][A-Za-z0-9_-]*$/

const ID_ATTR = /\sid\s*=\s*(["'])(.*?)\1/g

const ANY_ATTR = /\s[A-Za-z_:][\w.:-]*\s*=\s*(["'])(.*?)\1/g

const DRAWS = /<(rect|path|circle|ellipse|polygon|polyline|line|use|g|image|text)\b/

const HEX = /^#[0-9A-Fa-f]{3,8}$/

function refuse(source: string, what: string): never {
  throw new Error(`${source}: ${what}`)
}

export const inlineMark = (
  svg: string,
  source: string,
): { readonly viewBox: string; readonly body: string } => {
  if (svg.includes(MARK_TOKEN)) {
    refuse(source, `already contains the sentinel ${MARK_TOKEN}, which this transform needs to be its own`)
  }

  const open = /<svg\b[^>]*>/.exec(svg)
  if (open === null) refuse(source, "has no root <svg> element")
  const openTag = open[0]
  const close = svg.lastIndexOf("</svg>")
  if (close < open.index + openTag.length) {
    refuse(source, "has no closing </svg> for its root element")
  }
  const viewBoxAt = /\sviewBox\s*=\s*"([^"]*)"/.exec(openTag)
  const viewBox = viewBoxAt?.[1] ?? ""
  if (viewBox.trim() === "") {
    refuse(source, "root <svg> has no viewBox — the nested viewport has nothing to fit the artwork into")
  }

  let body = svg.slice(open.index + openTag.length, close)

  // A FIXPOINT, AND THEN A REFUSAL — because one pass is not a strip. Removing
  // a match splices what is on either side of it, and two halves can close up
  // into a delimiter that was not there before: `<!-<!-- -->-` is one match,
  // and taking it leaves `<!--` (CodeQL's
  // `js/incomplete-multi-character-sanitization`). And HTML's
  // comment-end-bang state accepts `--!>`, so a strip that knew only `-->`
  // would walk past `<!-- x --!>` and leave the whole of it standing.
  for (let before = ""; before !== body;) {
    before = body
    body = body.replace(/<!--[\s\S]*?--!?>/g, "")
  }
  const bogus = /<[!?]|--!?>/.exec(body)
  if (bogus !== null) {
    refuse(source, `still carries ${bogus[0]} after the comments were taken out`)
  }

  body = body
    .replace(/<title\b[^>]*\/>/g, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, "")
    .replace(/<desc\b[^>]*\/>/g, "")
    .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/g, "")

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

  const declared = new Set<string>()
  for (const found of body.matchAll(ID_ATTR)) {
    const id = found[2] ?? ""
    if (!ID_SHAPE.test(id)) {
      refuse(source, `declares the id "${id}", which is not a plain XML name this rewrite can prefix`)
    }
    if (declared.has(id)) refuse(source, `declares the id "${id}" twice`)
    declared.add(id)
  }
  const declaredCount = declared.size

  body = body.replace(
    /(\sid\s*=\s*)(["'])(.*?)\2/g,
    (_whole: string, before: string, quote: string, id: string) =>
      `${before}${quote}${MARK_TOKEN}${id}${quote}`,
  )
  body = body.replace(
    /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g,
    (_whole: string, quote: string, id: string) => {
      if (!declared.has(id)) {
        refuse(source, `references #${id}, which it does not declare`)
      }
      return `url(${quote}#${MARK_TOKEN}${id}${quote})`
    },
  )
  body = body.replace(
    /(\s(?:xlink:)?href\s*=\s*)(["'])#(.*?)\2/g,
    (_whole: string, before: string, quote: string, id: string) => {
      if (!declared.has(id)) {
        refuse(source, `references #${id}, which it does not declare`)
      }
      return `${before}${quote}#${MARK_TOKEN}${id}${quote}`
    },
  )

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

  return { viewBox: viewBox.trim(), body: body.trim() }
}
