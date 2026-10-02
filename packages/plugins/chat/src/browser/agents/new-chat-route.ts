import { defineAppRoute } from "olai-plugin-navigation/routes"

/** AppRoute currently requires a PageReading even for a local face; there is
 * no readingless arm. This inert projection opens no vault stream. The route
 * supplies its own title/breadcrumb and face. Chat's page-reading consumers
 * require a node (and origin first rejects this route), so the empty file is
 * never offered as a destination or read as node metadata. */
export const newChatRoute = defineAppRoute({
  claims: [{ kind: "exact", path: "/new-chat" }],
  parse: path => path === "/new-chat" ? true : null,
  href: () => "/new-chat",
  breadcrumb: () => "New chat",
  narrowable: false,
  request: () => ({ kind: "at" as const, address: null }),
  stream: { use: () => () => ({ shows: { kind: "outline", file: "", rows: [] }, names: [], doors: [], licences: [] }) },
})
