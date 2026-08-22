/**
 * Starting up, and the two ways it can go wrong.
 *
 * Both are about what the OPERATOR is told. A port that is already listening
 * is not a reason to refuse to serve, so it is not an error at all any more —
 * it is a line saying where we went instead. A port that cannot be bound for
 * any other reason IS an error, and the whole point of these tests is that the
 * error the reader gets is the real one: the bug they replace printed
 * `surface runtime faulted — unrecoverable: [object Object]` and exited before
 * the actual `cannot listen on …` could be reported.
 *
 * They start a real server on a real port. Nothing here is mocked, because the
 * thing under test is exactly the seam where Node's `listen` meets the Effect
 * runtime — the seam a mock would replace with an assumption.
 *
 * What they read is a collecting LOGGER rather than an injected callback: the
 * server logs the way every other package does, so the way to hear it is the
 * way anything hears an Effect log. That also means these assert on the pieces
 * — the level, the message, the annotations — rather than on one interpolated
 * sentence, which is the whole reason the pieces exist.
 */

import { DEFAULT_IDENTITY_HEADERS } from "@olai/identity"
import { collector, findSaid, type Logged } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as net from "node:net"

import { startWeb } from "./child.testlib.ts"
import { MANIFEST } from "./manifest.ts"
import { serve } from "./serve.ts"
import { served, SERVER_LAYERS, withServing } from "./serve.testlib.ts"

// A developer who exported OLAI_PORT_FILE (just run's file) would have
// every in-process serve() here rewrite that file and try their live
// port. child.testlib already strips it from CLI children; this is the
// twin. withPortFile below puts it back for the tests that are about it.
delete process.env.OLAI_PORT_FILE

/** A port with something already listening on it, closed with the test. */
const occupied = (): Promise<{ port: number; release: () => Promise<void> }> =>
  new Promise((resolve, reject) => {
    const squatter = net.createServer()
    squatter.on("error", reject)
    squatter.listen(0, "127.0.0.1", () => {
      const address = squatter.address()
      if (address === null || typeof address === "string") {
        reject(new Error("could not read a port from the squatter socket"))
        return
      }
      resolve({
        port: address.port,
        release: () => new Promise<void>((done) => squatter.close(() => done())),
      })
    })
  })

/** Run `serve` and shut it straight back down, collecting what it said. */
const run = (
  options: { readonly port: number; readonly host?: string },
): Promise<ReadonlyArray<Logged>> => {
  const { layer, said } = collector()

  return Effect.gen(function*() {
    yield* serve({
      root: served(),
      port: options.port,
      host: options.host ?? "127.0.0.1",
      clientDist: served(),
      allowedOrigins: [],
      identity: DEFAULT_IDENTITY_HEADERS,
      // These start and stop a real server against a temp directory; committing
      // to whatever repository happens to contain it is not theirs to do.
      git: { commit: "off", push: null },
    })
  }).pipe(
    Effect.scoped,
    Effect.provide(SERVER_LAYERS),
    Effect.provide(layer),
    Effect.map(() => said),
    Effect.runPromise,
  )
}

const url = /^http:\/\/127\.0\.0\.1:(\d+)$/

test("a port that is already listening is a fallback, not a failure", async () => {
  const taken = await occupied()
  try {
    const said = await run({ port: taken.port })

    const notice = findSaid(said, "port in use")
    expect(notice?.annotations.asked).toBe(taken.port)
    // It names where we went, and that is a DIFFERENT port that is really ours.
    const landed = url.exec(String(notice?.annotations.url))?.[1]
    expect(landed).toBeDefined()
    expect(Number(landed)).not.toBe(taken.port)
    // And the line everyone reads for the address agrees with it: the bound
    // address is the single source of truth, fallback or not.
    expect(findSaid(said, "serving")?.annotations.url).toBe(
      `http://127.0.0.1:${landed}`,
    )
  } finally {
    await taken.release()
  }
})

// Every line the served directory produces says which directory it was —
// including the ones a store fiber emits from three layers down, which is the
// reason the annotation is set before anything is started rather than added to
// each message by hand.
test("every line says which directory it is about", async () => {
  const said = await run({ port: 0 })

  const root = findSaid(said, "serving")?.annotations.root
  expect(typeof root).toBe("string")
  expect(said.every((line) => line.annotations.root === root)).toBe(true)
})

// The regression this file exists for. A host that is not this machine's
// cannot be bound, the scope unwinds, and closing the surface runtime settles
// its `done` on the way out — which used to be read as a fault, printed as
// `[object Object]`, and followed by `process.exit(1)`. An exiting process
// takes the test runner with it, so this failing is loud in the right way.
test("a listen failure is reported as itself, not as a faulted runtime", async () => {
  const failure = await run({ port: 7714, host: "192.0.2.1" }).then(
    () => undefined,
    (cause: unknown) => String(cause),
  )

  expect(failure).toBeDefined()
  expect(failure).toContain("cannot listen on 192.0.2.1:7714")
  expect(failure).not.toContain("[object Object]")
  expect(failure).not.toContain("faulted")
})

// A fallback is for a port someone else holds. Asking for one the OS picks is
// already that, so there is nothing to fall back FROM — and a retry loop on
// port 0 would be a way to hide a real bind failure behind a second one.
test("port 0 is a request, not a collision", async () => {
  const said = await run({ port: 0 })

  expect(findSaid(said, "port in use")).toBeUndefined()
  expect(String(findSaid(said, "serving")?.annotations.url)).toMatch(url)
})

// The CLI default is 0, not 7714. Spelled as a child so a `Flag.withDefault`
// of 7714 would fail this rather than only the in-process `run({ port: 0 })`
// above, which never goes through the flag. 7714 is what a deploy passes
// explicitly; a worktree that bound it by default is the incident this
// exists to close.
test("the process default asks the OS, it does not bind 7714", async () => {
  const server = startWeb({ root: served() })
  try {
    const bound = await server.address()
    expect(bound).toMatch(url)
    expect(bound).not.toBe("http://127.0.0.1:7714")
    expect(server.said()).not.toContain("port in use")
  } finally {
    server.kill()
    await server.exited()
  }
})

/** Point `OLAI_PORT_FILE` at a temp path for the length of `body`, and
 *  restore whatever was there. The env is the public seam (`just run`
 *  sets it); mutating it here is the test of that seam, not a back door. */
const withPortFile = async <A>(
  file: string,
  body: () => Promise<A>,
): Promise<A> => {
  const previous = process.env.OLAI_PORT_FILE
  process.env.OLAI_PORT_FILE = file
  try {
    return await body()
  } finally {
    if (previous === undefined) delete process.env.OLAI_PORT_FILE
    else process.env.OLAI_PORT_FILE = previous
  }
}

test("the bound url is written to OLAI_PORT_FILE", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "olai-port-file-"))
  const file = path.join(dir, "url")
  try {
    const said = await withPortFile(file, () => run({ port: 0 }))
    const bound = String(findSaid(said, "serving")?.annotations.url)
    expect(bound).toMatch(url)
    expect(fs.readFileSync(file, "utf8")).toBe(`${bound}\npid=${process.pid}\n`)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("a remembered url is rebound when the ask is port 0", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "olai-port-file-"))
  const file = path.join(dir, "url")
  try {
    const first = await withPortFile(file, () => run({ port: 0 }))
    const bound = String(findSaid(first, "serving")?.annotations.url)
    expect(bound).toMatch(url)
    const again = await withPortFile(file, () => run({ port: 0 }))
    expect(findSaid(again, "serving")?.annotations.url).toBe(bound)
    expect(findSaid(again, "port in use")).toBeUndefined()
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("a remembered port that is taken is a fallback, and the file follows", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "olai-port-file-"))
  const file = path.join(dir, "url")
  const taken = await occupied()
  try {
    fs.writeFileSync(file, `http://127.0.0.1:${taken.port}\n`)
    const said = await withPortFile(file, () => run({ port: 0 }))
    const bound = String(findSaid(said, "serving")?.annotations.url)
    expect(bound).toMatch(url)
    expect(bound).not.toBe(`http://127.0.0.1:${taken.port}`)
    expect(findSaid(said, "port in use")?.annotations.asked).toBe(taken.port)
    expect(fs.readFileSync(file, "utf8")).toBe(`${bound}\npid=${process.pid}\n`)
  } finally {
    await taken.release()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("a port file that cannot be written is a failure, not a defect", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "olai-port-file-"))
  const blocker = path.join(dir, "not-a-dir")
  fs.writeFileSync(blocker, "x")
  const file = path.join(blocker, "url")
  try {
    const failure = await withPortFile(file, () => run({ port: 0 })).then(
      () => undefined,
      (cause: unknown) => String(cause),
    )
    expect(failure).toBeDefined()
    expect(failure).toContain("cannot write the bound url")
    expect(failure).not.toContain("[object Object]")
    expect(failure).not.toContain("faulted")
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

// Binding off loopback is the one thing this layer warns about, and the LEVEL
// is now what says so — the message used to have to shout `WARNING:` at itself.
test("binding off loopback is a warning, not a line among lines", async () => {
  const said = await run({ port: 0, host: "0.0.0.0" })

  const warned = findSaid(said, "bound off loopback")
  expect(warned?.level).toBe("Warn")
  expect(warned?.annotations.host).toBe("0.0.0.0")
})

// ── the install surface, as an installer asks it ────────────────────────
//
// The manifest is this package's (`./manifest.ts`); the icons and the shell
// are the browser bundle's. The two packages do not import each other, and
// the static layer answers an unmatched path with the HTML shell — so a
// renamed icon still 200s, and only the content type says otherwise. These
// used to be browser scenarios (`install_it.feature`); they never opened a
// page worth looking at.
//
// The walk into `packages/web/src/client` is TEST-ONLY, and deliberate: it is
// the two ends of a contract whose packages do not import each other. The
// source `public/` stands in for the built dist because `web/src/build.ts`
// copies that directory to the dist root as-is (`publicDir: resolve(CLIENT,
// "public")`). The "never a service worker" half of the old e2e is NOT
// asserted here on the shell — a registration would live in the client
// bundle, and `web/src/client/claims.test.ts` holds that no file spells
// `serviceWorker`. What this file can see is that the shell itself does not
// inline one.

const WEB_CLIENT = path.join(import.meta.dirname, "../../web/src/client")

/** A dist that is the real shell and the real icons, plus one outline so the
 *  store will boot. Thrown away with the test. */
const installDist = (): string => {
  const dist = served()
  fs.copyFileSync(
    path.join(WEB_CLIENT, "index.html"),
    path.join(dist, "index.html"),
  )
  const publicDir = path.join(WEB_CLIENT, "public")
  for (const file of fs.readdirSync(publicDir)) {
    fs.copyFileSync(path.join(publicDir, file), path.join(dist, file))
  }
  return dist
}

const withInstall = (body: (url: string) => Promise<void>): Promise<void> => {
  const dist = installDist()
  return withServing({ root: dist, clientDist: dist }, (url) => body(url))
}

interface ManifestIcon {
  readonly src: string
  readonly type: string
  readonly purpose?: string
}

const ICONS: ReadonlyArray<ManifestIcon> = MANIFEST.icons ?? []

test("the install manifest is served as itself, not as the shell", async () => {
  await withInstall(async (url) => {
    const answer = await fetch(`${url}/manifest.webmanifest`)
    expect(answer.status).toBe(200)
    expect(answer.headers.get("content-type") ?? "").toMatch(
      /^application\/manifest\+json/,
    )
    const body = (await answer.json()) as {
      name?: string
      short_name?: string
      start_url?: string
      display?: string
      icons?: ReadonlyArray<ManifestIcon>
    }
    expect(body.name).toBe(MANIFEST.name)
    expect(body.short_name).toBe(MANIFEST.name)
    expect(body.display).toBe("standalone")
    expect(new URL(body.start_url ?? "/", url).pathname).toBe("/")
    expect((body.icons ?? []).map((icon) => icon.src)).toEqual(
      ICONS.map((icon) => icon.src),
    )
  })
})

test("every icon the manifest names is served as the type it claims", async () => {
  await withInstall(async (url) => {
    expect(ICONS.length).toBe(4)
    expect(ICONS.some((icon) => icon.purpose === "maskable")).toBe(true)
    for (const icon of ICONS) {
      const answer = await fetch(`${url}${icon.src}`)
      expect(answer.status).toBe(200)
      expect(answer.headers.get("content-type") ?? "").toMatch(
        new RegExp(`^${icon.type.replace("+", "\\+")}`),
      )
      expect((await answer.arrayBuffer()).byteLength).toBeGreaterThan(0)
    }
  })
})

test("the shell names the mark, the viewport, and no service worker", async () => {
  await withInstall(async (url) => {
    const answer = await fetch(`${url}/`)
    expect(answer.status).toBe(200)
    const html = await answer.text()
    expect(html).toContain('rel="icon"')
    expect(html).toContain('href="/icon.svg"')
    expect(html).toContain('rel="apple-touch-icon"')
    expect(html).toContain('href="/apple-touch-icon.png"')
    expect(html).toContain("width=device-width")
    expect(html).toContain("viewport-fit=cover")
    expect(html).toContain("interactive-widget=resizes-content")
    expect(html).not.toMatch(/serviceWorker/)

    const icon = await fetch(`${url}/icon.svg`)
    expect(icon.status).toBe(200)
    expect(icon.headers.get("content-type") ?? "").toMatch(/^image\/svg\+xml/)
    const touch = await fetch(`${url}/apple-touch-icon.png`)
    expect(touch.status).toBe(200)
    expect(touch.headers.get("content-type") ?? "").toMatch(/^image\/png/)
  })
})
