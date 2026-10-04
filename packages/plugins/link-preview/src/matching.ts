import type { Contribution } from "@olai/plugin-api/contracts"
import type { LinkPreview, Route } from "olai-plugin-navigation/contract"

export const matchPreview = (entries: ReadonlyArray<Contribution<LinkPreview>>, route: Route) =>
  entries.filter(entry => entry.value.matches(route))
    .sort((a, b) => b.value.priority - a.value.priority || a.owner.localeCompare(b.owner))[0]?.value

