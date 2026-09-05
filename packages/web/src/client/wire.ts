/**
 * One rooted connection follows the server's plugin roster in place.
 * Kolu retains the core, surviving sibling clients and standing subscriptions
 * across redial. Olai loads browser halves, serializes roster changes and
 * publishes plugin registrations after the new siblings are available.
 */

import { connectSurfaces } from "@kolu/surface-app/solid"
import type { Surface, SurfaceSpec } from "@kolu/surface/define"
import type { BrowserHalf, BrowserRow } from "@olai/bundle"
import { surface } from "@olai/surface"
import { createEffect, createRoot } from "solid-js"

import { composeTo } from "./plugins/runtime.ts"

/**
 * The word a degraded readout calls olai's own floor.
 *
 * It is a LABEL and never a tag segment — the root's members keep their bare
 * `surface/<member>/<verb>`, which is the whole difference between a root and a
 * sibling — so it reaches a reader and nothing else. `surfaceClientsHealth`
 * prefixes every stopped subscription with it (`olai/manifest`), which is what
 * makes a degraded readout say WHICH HALF went quiet rather than only that
 * something did. The framework has no name for an app's own floor and declines
 * to invent one, so it crosses as an argument; it must not be a plugin's name,
 * and the seam refuses at construction if it is.
 */
const CORE = "olai"

/**
 * THE FIRST DIAL — the root, and no siblings.
 *
 * NO `url`. It defaults to `surfaceWsUrl(location.origin)` — the ONE
 * scheme-swap and path both legs share (juspay/kolu#2165) — and a browser app
 * dialling the origin that served it is not a choice.
 *
 * `surfaces: {}` is the honest opening position and not a placeholder: this
 * page has not been told which plugins are running, and an empty sibling map is
 * exactly what "none, so far as I know" means. It is legal because the wire
 * carries a ROOT — the empty-map refusal shrank to "nothing at all was passed"
 * when the `core` slot landed, and core is always here.
 */
const live = await connectSurfaces({
  // OLAI'S OWN SURFACE AS THE ROOT — unprefixed, so its tags are unchanged and
  // the two reserved round-trips address them. That is what makes them
  // trustworthy on a wire whose SIBLING set varies per serve, and now varies
  // WITHIN one serve.
  core: { surface, name: CORE },
  surfaces: {} as Record<string, Surface<SurfaceSpec>>,
  // What happens when the server retires this wire. Required by the seam, with
  // no default, so a wire that compiles has been asked what happens when it
  // dies.
  //
  // What a READER sees is not wired from here: the indicator and the reload
  // screen ride `readout()`, so the retirement has ONE source and the dot and
  // the screen cannot disagree about it. This is the RECORD — one line naming
  // the moment, for whoever is looking at the console of a tab that stopped.
  // A `warn`, not an `error`: nothing is broken, the server was replaced.
  retired: () =>
    console.warn(
      "olai: the server retired this tab — it was replaced by a newer process, so this page will not update again until it is reloaded",
    ),
})

/**
 * A SET OF PLUGIN NAMES AS ONE VALUE — what {@link composed} holds and what the
 * loop below compares against it.
 *
 * Unsorted, because the roster's order is the bundle's and is stable, so the
 * joined list moves exactly when the answer does. `""` is a wire with no
 * sibling on it, which is what the first dial is and what a serve running no
 * plugins stays.
 *
 * A FUNCTION rather than a `.join` at each of the two sites, and the two sites
 * are the whole reason: one writes the signature and one compares against it,
 * so a separator changed in one place and not the other leaves the loop either
 * spinning (never equal) or wedged (always equal). Neither fails loudly.
 */
const signatureOf = (names: ReadonlyArray<Named>): string =>
  names.map((one) => one.chunk === null ? one.id : `${one.id}\t${one.chunk}`).join("\n")

/**
 * ONE PLUGIN THE ROSTER NAMES, and where its browser half comes from.
 *
 * `chunk` is `null` for every plugin this build compiled in: its half is a chunk
 * of the bundle, named by a literal `import()` in a generated row, and the table
 * that holds those thunks is the one thing the tab may know about plugins ahead
 * of time (`@olai/bundle`'s `rows.ts`).
 *
 * It is a URL for a plugin the VAULT defines, which the serve compiled out of a
 * note and answers under `/_olai/plugins/<name>-<version>.js`. THE VERSION IS IN
 * THE PATH, which is why it rides the signature above: an edit somebody approved
 * is a different URL, so the comparison that decides whether to redial sees the
 * change — where a signature of names alone would call the new code the same
 * roster and leave the old module mounted.
 */
interface Named {
  readonly id: string
  readonly chunk: string | null
}

/** THE PLUGINS THIS WIRE CARRIES, as that signature. */
let composed = ""

/**
 * BRING THE WIRE INTO LINE WITH THE ROSTER — load, dial, then mount.
 *
 * The ORDER is the whole of it and none of it is arbitrary:
 *
 *   1. **load** the chunks the roster names. Nothing is fetched for a plugin
 *      this serve is not running, which is the browser's form of *no fiber, no
 *      surface, no handler* (`@olai/bundle`'s `rows.ts`).
 *   2. **redial** with their surfaces. A fiber must never be started over a
 *      wire that does not carry its sibling — that is the subscribe licence the
 *      old arrangement spent a module arguing, and here it is a line of
 *      sequencing instead.
 *   3. **compose** the fibers, which is where a plugin's faces are registered
 *      and its own client is first reachable.
 *
 * ## A FAILURE COSTS THE PAGE NOTHING
 *
 * A chunk that will not load and a dial that throws are the same case, and
 * `redial` owns it: the replacement is dialled first and this connection
 * released only once that has resolved, so a throw leaves the working wire
 * exactly as it was. What this function does about it is say so on the console
 * and leave `composed` where it was — so the next roster frame tries again
 * rather than the page being stuck holding a wire it thinks is newer than it
 * is.
 */
const rerost = async (want: ReadonlyArray<Named>): Promise<void> => {
  const signature = signatureOf(want)
  // ONE AT A TIME, and it is the roster's own shape that makes this reachable
  // rather than theoretical. `composed` is only written on SUCCESS — which is
  // right, because a failed redial must leave the next frame free to try again
  // — so between the first frame and its redial resolving, the guard the loop
  // reads still says the old signature. A second frame in that window (a
  // reconnect republishing, a plugin failing while another is being brought in)
  // passes the guard and starts a SECOND `live.redial` on the same connection,
  // which the seam refuses outright: it would dial a third wire while the
  // caller still believes it holds one.
  //
  // Queued rather than dropped. Dropping would be simpler and would lose the
  // last frame's answer if it arrived mid-flight, leaving the tab following a
  // roster the server has already moved off — silently, since nothing would
  // republish to correct it. Chaining costs one more redial in a window that
  // is one round trip wide.
  const mine = inFlight.then(() => rerostNow(want, signature), () => rerostNow(want, signature))
  inFlight = mine.then(() => {}, () => {})
  return mine
}

/** The tail of {@link rerost}, entered only when no other redial is running. */
/**
 * THE BUILD'S BROWSER ROWS, told rather than imported — see the note beside
 * {@link useBrowserRows}.
 *
 * Empty until the entry has said, and that is not a window anything falls
 * through: the redial below runs off a roster frame, which arrives over a wire
 * this module dials on the entry's own import, and `./main.tsx` says this
 * before it awaits the first roster.
 */
let rows: ReadonlyArray<BrowserRow> = []

/**
 * WHICH PLUGINS THIS BUILD HAS, from the one module that may know.
 *
 * `@olai/bundle` names every plugin, so a package a PLUGIN imports may not
 * import it back — and a plugin's browser half imports this app, because a face
 * that draws inside this app draws with this app's furniture. That is one
 * sentence and it is the whole reason this is a setter rather than an import:
 * without it every plugin is on every other plugin's graph, and the fence's
 * tenant derivation says so before a reader would ever notice.
 *
 * `./main.tsx` is the one caller. It is the app's ENTRY — nothing imports it —
 * so it is the one place in this package that may still name the registry.
 */
export const useBrowserRows = (built: ReadonlyArray<BrowserRow>): void => {
  rows = built
}

let inFlight: Promise<void> = Promise.resolve()

const rerostNow = async (want: ReadonlyArray<Named>, signature: string): Promise<void> => {
  // ...and once it is our turn, the answer may already be the one on the wire:
  // the frame ahead of us in the queue may have been for the same roster.
  if (signature === composed) return
  try {
    const halves = await Promise.all(
      want.flatMap((one) => {
        // A PLUGIN THE VAULT DEFINES is fetched from the serve that compiled
        // it; everything else is a chunk of this bundle, and a name with
        // neither is skipped rather than thrown on — a serve running a plugin
        // this build does not have is a tab talking to a newer server, and the
        // honest answer is that its faces are absent.
        if (one.chunk !== null) return [chunkAt(one.chunk)]
        const row = rows.find((each) => each.id === one.id)
        return row === undefined ? [] : [row.load()]
      }),
    )
    // The cast is what a tab that follows the roster costs at the type level,
    // and it is worth naming rather than hiding. The old arrangement recovered
    // a per-key surface type from a compiled-in tuple, which typed each
    // sibling's client by its own spec; a chunk loaded by a name that is DATA
    // cannot carry that, because the names are not literals until runtime.
    // Nothing downstream wanted it: `ctx.wired.client()` is `unknown` by design
    // — core cannot type a plugin's client without learning its members — and
    // every plugin narrows it once, at its own edge, against a shape it
    // declares itself.
    const established = live.connectionEpoch()
    await live.redial(surfaceMapOf(halves))
    // Kolu skips an unchanged surface map, but a changed plugin roster can
    // also change the upgrade-header policy (a plugin need not own a surface).
    // Refresh an unchanged, open socket so its next accept reads that policy.
    // A replacement still connecting already reads it on its own next open.
    if (live.connectionEpoch() === established && live.link.wire.status() === "open") {
      // forceReconnect only initiates a close. An arriving provider (identity
      // in particular) may ask immediately when composed, so do not mount it
      // against the closing socket. Bound the wait so an unreachable server
      // cannot hold the roster queue forever.
      let detach = () => {}
      let deadline: ReturnType<typeof setTimeout> | undefined
      try {
        await new Promise<void>((resolve, reject) => {
          deadline = setTimeout(() => reject(new Error("plugin roster socket refresh timed out")), 10_000)
          detach = live.link.wire.onStatus((status) => {
            if (status === "open") resolve()
            else if (status === "retired") reject(new Error("plugin roster socket retired during refresh"))
          })
          live.link.wire.forceReconnect()
        })
      } finally {
        detach()
        clearTimeout(deadline)
      }
    }
    await composeTo(halves, (plugin) => (live.clients as Record<string, unknown>)[plugin])
    composed = signature
  } catch (refused) {
    console.error(
      "olai: this tab could not follow the server's plugin roster, so it is still serving the previous one",
      refused,
    )
    return
  }
}

/**
 * A BROWSER HALF FETCHED AT RUNTIME — the one `import()` in this app whose
 * specifier is not a literal, and it is deliberately not one.
 *
 * A bundler splits on a literal and resolves nothing else, which is exactly what
 * is wanted here: the URL is a fact the ROSTER carries, about a plugin whose
 * source did not exist when this bundle was built, so there is nothing for the
 * build to have split out. `bun build` leaves a computed `import()` as a runtime
 * import for the same reason it cannot split it.
 *
 * ITS THREE IMPORTS ARE ALREADY BOUND. The serve compiled the half with
 * `@olai/plugin-api`, `effect` and `solid-js` rewritten to reads of
 * `./plugins/shared.ts`'s table — so what arrives is a module with no imports at
 * all, holding THIS app's Solid and THIS app's service tags. That is the whole
 * reason a face an agent wrote can sit inside a provider a shipped plugin
 * registered.
 */
const chunkAt = (url: string): Promise<BrowserHalf> =>
  import(/* @vite-ignore */ url) as Promise<BrowserHalf>

/** The halves' surfaces, keyed by name — the shape every composition door
 *  takes. Built here rather than through `@olai/plugin-api`'s `surfacesOf`
 *  because a browser half carries no `faces`: which face may see which member
 *  is a SERVE's question, and there is one face in a tab.
 *
 *  A HALF WITH NO SURFACE IS LEFT OUT rather than entered as `undefined`, and it
 *  is a whole kind of plugin: an ENGINE composes no sibling, because what it
 *  contributes to the tab already travels on the chat cell (`@olai/bundle`'s
 *  `BrowserHalf`). Such a half is mounted and never dialled, and an entry
 *  holding `undefined` would be a sibling key the framework was asked to
 *  compose nothing under. */
const surfaceMapOf = (
  halves: ReadonlyArray<BrowserHalf>,
): Record<string, Surface<SurfaceSpec>> =>
  Object.fromEntries(
    halves.flatMap((half) =>
      half.surface === undefined
        ? []
        : [[half.default.name, half.surface as Surface<SurfaceSpec>] as const]
    ),
  )

/** Wait for initial plugin providers to avoid drawing the shell before they
 * arrive. The deadline lets an unreachable server still draw its readout. */
const FIRST_ROSTER_MS = 1500

/** Resolved by whichever comes first: the roster settling, or the deadline. */
let settle: () => void = () => {}
export const firstRoster: Promise<void> = new Promise<void>((resolve) => {
  settle = resolve
  setTimeout(resolve, FIRST_ROSTER_MS)
})

createRoot(() => {
  const roster = live.core.cells.plugins.use()
  createEffect(() => {
    const value = roster.value()
    // PENDING is not the empty roster. A cell that has not answered says
    // nothing about which plugins are running, and dialling none of them
    // because of it would be this page inventing a policy.
    if (value === undefined) return
    // WHAT TO LOAD, per running row — the word, and for a plugin the VAULT
    // defines the URL its browser half is served from. A built row has no
    // `source`, so `chunk` is `null` and the compiled-in table below is what
    // answers for it; a definition has no entry in that table and could not,
    // because its source did not exist when this bundle was built.
    const want = value.built
      .filter((row) => row.running)
      .map((row) => ({ id: row.name, chunk: row.source?.chunk ?? null }))
    if (signatureOf(want) === composed) {
      settle()
      return
    }
    void rerost(want).then(settle)
  })
})

/** Core and its standing subscriptions retain their identity across rosters. */
export const olai = live.core

/** Kolu owns reconnecting, degraded and terminal retirement state. */
export const connectionReadout = live.readout

/** Re-fetch per-connection answers after an establishment; never remount UI. */
export const connectionEpoch = live.connectionEpoch
