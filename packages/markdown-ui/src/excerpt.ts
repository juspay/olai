/** Select sanitized rendered blocks without losing heading identity (including
 * duplicate slugs). Markdown still owns waiting, failure and link decoration. */
export function markdownExcerpt(html: string, excerpt: { readonly after?: string; readonly blocks: number }) {
  const template = document.createElement("template")
  template.innerHTML = html
  const heading = excerpt.after === undefined ? undefined
    : [...template.content.querySelectorAll("h1,h2,h3,h4,h5,h6")].find(node => node.id === excerpt.after)
  if (excerpt.after !== undefined && !heading) return { missing: true, title: "", html: "" }
  const nodes = [...template.content.children]
  const selected: Element[] = []
  for (const node of nodes.slice(heading ? nodes.indexOf(heading) + 1 : 0)) {
    if (heading && /^H[1-6]$/.test(node.tagName) && node.tagName <= heading.tagName) break
    selected.push(node)
    if (selected.length >= excerpt.blocks) break
  }
  return { missing: false, title: heading?.textContent?.replace(/^#\s*/, ""), html: selected.map(node => node.outerHTML).join("") }
}
