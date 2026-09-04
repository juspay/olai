import type { AppRoute } from "@olai/plugin-api"
import type { Route } from "@olai/web/client/routes.ts"

import { name } from "../wire.ts"
import { journalWire } from "./wire.ts"

type DayPage = { readonly today: true } | { readonly date: string }

export const dayRoute = (date: string): Route => ({
  kind: "plugin",
  plugin: name,
  page: "day",
  value: { date },
})

export const todayRoute: Route = {
  kind: "plugin",
  plugin: name,
  page: "day",
  value: { today: true },
}

export const agendaRoute: Route = {
  kind: "plugin",
  plugin: name,
  page: "agenda",
  value: {},
}

const dayPage = (value: unknown): DayPage => value as DayPage

export const day: AppRoute = {
  id: "day",
  parse: (pathname) => {
    if (pathname === "/today") return { today: true }
    if (!pathname.startsWith("/d/")) return null
    try {
      return { date: decodeURIComponent(pathname.slice(3)) }
    } catch {
      return null
    }
  },
  href: (value) => {
    const page = dayPage(value)
    return "today" in page ? "/today" : `/d/${encodeURIComponent(page.date)}`
  },
  breadcrumb: (value) => {
    const page = dayPage(value)
    return "today" in page ? "Today" : page.date
  },
  narrowable: true,
  request: (value, today) => {
    const page = dayPage(value)
    return { kind: "day", date: "today" in page ? today : page.date }
  },
  stream: {
    use: (input) =>
      journalWire().streams.day.use(() => {
        const request = input() as { readonly date: string } | null
        return request === null ? null : { date: request.date }
      }),
  },
  face: () => null,
}

export const agenda: AppRoute = {
  id: "agenda",
  parse: (pathname) => pathname === "/agenda" ? {} : null,
  href: () => "/agenda",
  breadcrumb: () => "Agenda",
  narrowable: true,
  request: (_value, today) => ({ kind: "agenda", today }),
  stream: {
    use: (input) =>
      journalWire().streams.agenda.use(() => {
        const request = input() as { readonly today: string } | null
        return request === null ? null : { today: request.today }
      }),
  },
  face: () => null,
}
