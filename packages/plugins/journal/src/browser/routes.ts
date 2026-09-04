import { defineAppRoute, type Route } from "@olai/web/client/routes.ts"

import { journalWire } from "./wire.ts"
import type { AgendaPageRequest, DayPageRequest } from "../wire.ts"

type DayPage = { readonly today: true } | { readonly date: string }

export const day = defineAppRoute<DayPage, DayPageRequest>({
  claims: [
    { kind: "exact", path: "/today" },
    { kind: "prefix", path: "/d/" },
  ],
  parse: (pathname) => {
    if (pathname === "/today") return { today: true }
    if (!pathname.startsWith("/d/")) return null
    try {
      return { date: decodeURIComponent(pathname.slice(3)) }
    } catch {
      return null
    }
  },
  href: (page) => "today" in page ? "/today" : `/d/${encodeURIComponent(page.date)}`,
  breadcrumb: (page) => "today" in page ? "Today" : page.date,
  narrowable: true,
  request: (page, today) => {
    return { kind: "day", date: "today" in page ? today : page.date }
  },
  stream: {
    use: (input) => journalWire().streams.day.use(input),
  },
})

export const agenda = defineAppRoute<Record<never, never>, AgendaPageRequest>({
  claims: [{ kind: "exact", path: "/agenda" }],
  parse: (pathname) => pathname === "/agenda" ? {} : null,
  href: () => "/agenda",
  breadcrumb: () => "Agenda",
  narrowable: true,
  request: (_value, today) => ({ kind: "agenda", today }),
  stream: {
    use: (input) => journalWire().streams.agenda.use(input),
  },
})

export const dayRoute = (date: string): Route => day.to({ date })
export const todayRoute: Route = day.to({ today: true })
export const agendaRoute: Route = agenda.to({})
