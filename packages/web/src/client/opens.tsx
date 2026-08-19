/**
 * WHERE A PATH OF THIS VAULT OPENS, reachable from wherever somebody is handed
 * one.
 *
 * There is exactly one such place and it is a strange one: a `.html` preview,
 * where a reader clicks a link inside somebody else's saved page and the seal
 * hands the path out over `postMessage` (`@olai/surface`'s `seal.ts`,
 * `../document/Hypertext.tsx`). Everywhere else in this client a link is
 * already a `Route` by the time anything looks at it — a `<Link>` is drawn from
 * one, and a link in rendered markdown is parsed into one by `./routes.ts`'s
 * `routeIn`. A path is the shape that arrives when the thing that produced it
 * could not know what this app draws.
 *
 * A CONTEXT rather than a prop, for the reason documents and the router are
 * contexts: the asker is a component several levels down a page it does not
 * own, and threading an answer through `./document/DocumentPage.tsx` and the
 * face table (`./document/faces.tsx`) would make every kind's signature a
 * function of what one of them needs.
 *
 * THE ANSWER RATHER THAN THE LISTS is what travels, and that is the decision
 * worth arguing. The alternative is a context per list — the documents' paths
 * and the outlines' — with the component branching on which one held the path.
 * That hands a UI component the job of knowing that a `.md` is drawn as a body
 * and an outline as a tree, which is `./page.ts`'s job and nobody else's; it is
 * also the shape that quietly goes wrong when a fourth kind of file arrives.
 * What crosses here is one function ({@link opensAt}, applied to the set as it
 * stands this frame), so the component asks a question and gets a route.
 */

import { createContext, type JSX, useContext } from "solid-js"

import type { Route } from "./routes.ts"

/** Where a vault path opens, or nothing for a path this directory does not
 *  hold — {@link opensAt}, bound to the set as it stands. */
export type Opens = (path: string, at?: string) => Route | undefined

const OpensContext = createContext<Opens>()

export function OpensProvider(props: {
  readonly opens: Opens
  readonly children: JSX.Element
}) {
  return (
    <OpensContext.Provider value={props.opens}>
      {props.children}
    </OpensContext.Provider>
  )
}

/** Where a vault path opens — or a throw when a consumer is drawn outside the
 *  provider, which is a bug in this app rather than a state a reader reaches. */
export const useOpens = (): Opens => {
  const opens = useContext(OpensContext)
  if (opens === undefined) {
    throw new Error("a vault path looked up outside <OpensProvider>")
  }
  return opens
}
