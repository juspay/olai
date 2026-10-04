/**
 * What a press on a WRITTEN link asks for, read off the anchor — and the one
 * difference between the two readings: Alt+click prefers the route the
 * renderer stamped (`ROUTE_HREF`) over a page-local fragment, while a plain
 * press never reads the stamp, so it stays the browser's own scroll.
 *
 * No DOM here, so the anchor is the two methods the reading touches.
 */
import { ROUTE_HREF } from "@olai/web/client/press.ts"
import { afterAll, beforeAll, expect, test } from "bun:test"

import { atFile } from "../routes.ts"
import { routingIn } from "../routes.testlib.ts"
import { followed, followedSplit } from "./written.ts"

class FakeElement {
  constructor(private readonly attributes: Readonly<Record<string, string>>) {}
  closest(selector: string): FakeElement | null { return selector === "a" ? this : null }
  getAttribute(name: string): string | null { return this.attributes[name] ?? null }
}

const saved = Object.getOwnPropertyDescriptor(globalThis, "Element")
beforeAll(() => { Object.defineProperty(globalThis, "Element", { configurable: true, value: FakeElement }) })
afterAll(() => {
  if (saved) Object.defineProperty(globalThis, "Element", saved)
  else Reflect.deleteProperty(globalThis, "Element")
})

const press = (attributes: Record<string, string>, keys: { altKey?: boolean; shiftKey?: boolean } = {}) => ({
  target: new FakeElement(attributes), button: 0, defaultPrevented: false,
  metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...keys,
}) as unknown as MouseEvent

const routes = routingIn()
const fragment = { href: "#md-1abc-beds", [ROUTE_HREF]: "/notes/garden.md#beds" }

test("Alt+click on an in-page fragment opens the route stamped beside it", () => {
  expect(routes.routeIn("/notes/garden.md#beds")).toMatchObject({ kind: "at", address: { kind: "heading", slug: "beds" } })
  expect(followedSplit(routes, press(fragment, { altKey: true }))).toEqual(routes.routeIn("/notes/garden.md#beds"))
  expect(followedSplit(routes, press(fragment, { altKey: true, shiftKey: true }))).toEqual(routes.routeIn("/notes/garden.md#beds"))
})

test("a plain press on the same fragment is left to the browser's scroll", () => {
  expect(followed(routes, press(fragment))).toBeNull()
})

test("an unstamped anchor is read by its href, as before", () => {
  expect(followedSplit(routes, press({ href: "/notes/garden.md" }, { altKey: true }))).toEqual(atFile("notes/garden.md"))
  expect(followedSplit(routes, press({ href: "#md-1abc-beds" }, { altKey: true }))).toBeNull()
  expect(followed(routes, press({ href: "/notes/garden.md" }))).toEqual(atFile("notes/garden.md"))
})
