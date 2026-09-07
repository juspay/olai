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

/**
 * ## NOTHING LIVE CROSSES THIS DOOR ANY MORE
 *
 * There was a Solid context here with a module-variable FALLBACK beside it: the
 * row's `files` component called `holdOpens`, and `olai-plugin-markdown`'s
 * hypertext preview read `useOpens` across the package wall with no dependency
 * declared anywhere (the audit's §12). The provider itself had no user at all —
 * every reader went through the fallback.
 *
 * `navigation.file-links` already carried the same value, which is what the one
 * consumer names now. What is left here is the SHAPE, which is what a contract
 * door is for.
 */

import type { Route } from "olai-plugin-navigation/routes"

/** Where a vault path opens, or nothing for a path this directory does not
 *  hold — `opensAt`, bound to the set as it stands. */
export type Opens = (path: string, at?: string) => Route | undefined
