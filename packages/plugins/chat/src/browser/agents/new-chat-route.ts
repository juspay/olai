import { defineAppRoute } from "olai-plugin-navigation/routes"

/** A local page: its empty reading needs no vault subscription or process. */
export const newChatRoute = defineAppRoute({
  claims: [{ kind: "exact", path: "/new-chat" }],
  parse: path => path === "/new-chat" ? true : null,
  href: () => "/new-chat",
  breadcrumb: () => "New chat",
  narrowable: false,
  request: () => ({ kind: "at" as const, address: null }),
  stream: { use: () => () => ({ shows: { kind: "outline", file: "", rows: [] }, names: [], doors: [], licences: [] }) },
})
