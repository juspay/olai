import type {} from "../slots.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { PluginFaces } from "./Asides.tsx"
import { crumbAsides } from "./faces.ts"

/**
 * WHAT A PLUGIN HANGS ON ONE CRUMB — chat's agent mark, on any ancestor that
 * is a node agent, and whatever another plugin learns to mark. The crumb is
 * the LINK to the ancestor's own page; this sits beside it and is the other
 * door (the ancestor's conversation), so it is a sibling rather than a child
 * of that link.
 *
 * The wrapper (and the `data-plugin` fact it carries) is `./Asides.tsx`'s, once
 * for rows and crumbs alike; this names the table and the test id a crumb's
 * furniture is found by.
 *
 * An unheld or empty table draws nothing at all, which is what makes a serve
 * with no chat row's crumbs look exactly as they did before this slot existed.
 */
export function CrumbAside(props: { readonly node: string }) {
  return <PluginFaces faces={crumbAsides()} node={props.node} testid={TESTID.crumbAside} />
}
