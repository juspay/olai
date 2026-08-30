import { composeSurfaceContracts } from "@kolu/surface/define"
import { SERVERS } from "@olai/plugins/server"
import { enabled, surfacesOf } from "@olai/plugins/wire"
import { rosterOf } from "./runtime.ts"

const offered = { env: {}, now: () => "now", served: "/tmp" }
const roster = rosterOf(offered)
console.log("ROSTER:", roster.built.map((r) => `${r.name}=${r.running ? "On" : "Off"}`).join(" "))
const composed = enabled(SERVERS as any, null)
const group = composeSurfaceContracts(surfacesOf(composed as any) as any)
const tags = [...(group as any).group.requests.keys()].map((t) => String(t).split("/").slice(0, 2).join("/"))
console.log("SERVED PREFIXES:", [...new Set(tags)].sort().join(" "))
