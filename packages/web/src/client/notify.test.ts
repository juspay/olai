import { expect, test } from "bun:test"
import { createNotifications, notifyClick, type Notice } from "./notify.ts"
const notice: Notice = { tag: "ask", title: "Question", body: "Waiting", data: { kind: "ask" } }
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

test("notification owner releases observers, rereads permission, and cancels delayed delivery", async () => {
  const status = new EventTarget()
  let added = 0, removed = 0, clicks = 0, stopped = 0, shown = 0
  const query = async () => ({
    addEventListener: (...args: Parameters<EventTarget["addEventListener"]>) => { added++; status.addEventListener(...args) },
    removeEventListener: (...args: Parameters<EventTarget["removeEventListener"]>) => { removed++; status.removeEventListener(...args) },
  })
  let permission: NotificationPermission = "default"
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const seam = { requestPermission: async () => { await pending; return true }, show: async () => { shown++ }, onClick: () => { clicks++; return () => { stopped++ } } }
  const first = createNotifications({ seam, permission: () => permission, query })
  await flush()
  first.onPress(() => {})
  const delivery = first.notify(notice)
  expect([added, clicks]).toEqual([1, 1])
  first.dispose()
  first.dispose()
  permission = "granted"
  release()
  await delivery
  status.dispatchEvent(new Event("change"))
  expect([removed, stopped, shown]).toEqual([1, 1, 0])
  expect(first.consent()).toBe("default")
  const second = createNotifications({ seam, permission: () => permission, query })
  expect(second.consent()).toBe("granted")
  await second.notify(notice)
  expect(shown).toBe(1)
  second.dispose()
  await flush()
  expect(added).toBe(removed)
})

test("a permission query resolving after withdrawal attaches no listener", async () => {
  let land!: (value: EventTarget) => void
  let added = 0
  const target = new EventTarget()
  const add = target.addEventListener.bind(target)
  target.addEventListener = (...args) => { added++; add(...args) }
  const state = createNotifications({ permission: () => "unsupported", query: () => new Promise(resolve => { land = resolve }) })
  state.dispose()
  land(target)
  await flush()
  expect(added).toBe(0)
})

test("a click envelope of ours is read", () => {
  expect(notifyClick({ kind: "ask" })).toEqual({ kind: "ask" })
})

test("anything that is not one of ours is dropped", () => {
  // What a stale worker or a pre-upgrade notification substitutes, and what the
  // framework's seam hands over unvalidated. It warns and drops rather than
  // routing it (`@kolu/surface-app/notify`), which is why this gate exists at
  // all — a press that arrived as `{}` would otherwise open the panel for a
  // reason nobody can name.
  expect(notifyClick({})).toBeUndefined()
  expect(notifyClick(null)).toBeUndefined()
  expect(notifyClick("ask:3")).toBeUndefined()
  expect(notifyClick({ kind: "terminal" })).toBeUndefined()
})
