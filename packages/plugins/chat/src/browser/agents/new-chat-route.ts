import { defineAppRoute } from "olai-plugin-navigation/routes"

/** A local draft face: navigation supplies no vault request or page reading. */
export const newChatRoute = defineAppRoute({
  claims: [{ kind: "exact", path: "/new-chat" }],
  parse: path => path === "/new-chat" ? true : null,
  href: () => "/new-chat",
  breadcrumb: () => "New chat",
  local: true,
})
