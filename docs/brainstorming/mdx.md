# mdx: executable documents

Status: brainstorm (2026-08-10). Standalone feature — nothing to do with the landing page or the website. Not scheduled. No roadmap entry.

Idea: foo.md is markdown, data. foo.mdx is markdown plus components, code. The EXTENSION is the trust boundary — no sanitize exceptions, no per-file config: .md goes through the sanitizing pipeline as today, .mdx is a program you chose to put in your own notebook.

Precedent worth remembering: the racket olai's files WERE programs (#lang olai). Executable documents are the project's ancestry, not an invasion.

## what components?

The interesting ones aren't widgets, they're views over your own outline:

- <Query filter="is:open #techdebt"/> — a live node list inside prose
- <Tree node="…"/> — transclude a subtree where you're writing
- <Calendar/>, day/journal embeds
- eventually whatever search's operator language can say, embeddable

First cut: components come from OLAI'S REGISTRY only (passed in via the MDX components prop). Author composes them with prose + plain JSX; no imports, no npm resolution inside notebooks. Arbitrary user-authored components are a later door, if ever.

## mechanics

- compile server-side: the babel infra already exists (build.ts drives babel-preset-solid); @mdx-js/mdx with jsxImportSource solid-js. Ship the compiled module; browser imports and renders with the registry.
- live like everything else: recompile on the probe tick, same as a .md edit reaching the page.
- a compile error is a broken file: renders in place, rest stays live — the errors-as-data discipline already knows this shape.

## sharp edges

- executing notebook code in the server process (compile is fine; RENDERING happens client-side, so evaluation lives in the browser — keep it there).
- MDX ecosystem is React-first; solid-mdx is niche. Pin and vendor accordingly.
- the registry is a public API the moment it ships; start tiny.

## relation to directives

remark directives (:::hero etc., see landing-page.md) are the data-side answer for .md files and may ship first/instead. MDX is the code-side answer for people who want composition. They coexist: directives for sanitized prose everywhere, .mdx where you opted into code.

## open

1. is <Query> the actual motivation? if so, search's operator language is the dependency, not MDX itself.
2. registry contents v1
3. does chat's agent get to write .mdx? (it writes through ops today; whole-file writes are rejected — an .mdx is a whole file.)
