import type {} from "../slots.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { PluginFaces } from "./Asides.tsx"
import { crumbAsides } from "./faces.ts"

export function CrumbAside(props: { readonly node: string }) {
  return <PluginFaces faces={crumbAsides()} node={props.node} testid={TESTID.crumbAside} />
}
