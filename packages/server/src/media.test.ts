import { BODY_REFUSED } from "@olai/surface"
import { expect, test } from "bun:test"
import { request } from "node:http"
import * as fs from "node:fs"
import * as path from "node:path"

import { served, withServing } from "./serve.testlib.ts"

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

const PAGE = `<!doctype html>
<html lang="en"><head><base href="https://example.invalid/vault/"></head>
<body><h1>Report</h1><script>document.title = "ran"</script></body></html>
`

const vault = (): string => {
  const root = served()
  fs.mkdirSync(path.join(root, "notes", "art"), { recursive: true })
  fs.writeFileSync(path.join(root, "notes", "report.html"), PAGE)
  fs.writeFileSync(path.join(root, "notes", "art", "shot.png"), PIXEL)
  fs.writeFileSync(path.join(root, "notes", "page.css"), "h1 { color: red }\n")
  fs.writeFileSync(path.join(root, "notes", "chart.js"), "window.drew = true\n")
  fs.writeFileSync(path.join(root, "notes", "finishes.md"), "# Finishes\n")
  fs.writeFileSync(path.join(root, "notes", "secret.env"), "TOKEN=hunter2\n")
  fs.writeFileSync(path.join(root, "notes", "q3.pdf"), "%PDF-1.4\n")
  fs.writeFileSync(
    path.join(root, "notes", "art", "diagram.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg"><script>top.x=1</script></svg>\n`,
  )
  fs.writeFileSync(path.join(root, "notes", "sales.csv"), "region,units\nnorth,12\n")
  return root
}

const withVault = (body: (url: string) => Promise<void>): Promise<void> =>
  withServing({ root: vault() }, (url) => body(url))

// `fetch` builds a WHATWG URL, and that resolver removes `..` and `%2e%2e`
// before the request leaves the process; node's client writes the path out
// verbatim, which is the request this guard exists to answer.
const askRaw = (
  url: string,
  at: string,
): Promise<{ status: number; location: string | undefined }> => {
  const { promise, resolve, reject } = Promise.withResolvers<{
    status: number
    location: string | undefined
  }>()
  const base = new URL(url)
  const asking = request(
    { host: base.hostname, port: base.port, path: at, method: "GET" },
    (answer) => {
      answer.resume()
      resolve({ status: answer.statusCode ?? 0, location: answer.headers.location })
    },
  )
  asking.on("error", reject)
  asking.end()
  return promise
}

test("a served page arrives sealed, with the file's own bytes after the seal", async () => {
  await withVault(async (url) => {
    const answer = await fetch(`${url}/media/notes/report.html`)
    expect(answer.status).toBe(200)
    expect(answer.headers.get("content-type")).toBe("text/html; charset=utf-8")

    const policy = answer.headers.get("content-security-policy") ?? ""
    expect(policy).toContain("sandbox allow-scripts")
    expect(policy).not.toContain("allow-same-origin")
    const host = new URL(url).host
    expect(policy).toContain(`default-src http://${host}/media/ https://${host}/media/`)
    expect(policy).toContain("'unsafe-inline'")
    expect(policy).toContain("form-action 'none'")
    expect(policy).toContain("base-uri 'none'")

    const body = await answer.text()
    expect(body.startsWith("<!doctype html>")).toBe(true)
    expect(body.indexOf("olai:page-sealed")).toBeLessThan(body.indexOf("<html"))
    expect(body.endsWith(PAGE)).toBe(true)
  })
})

test("a page's parts, and every file drawn by pointing at it, are served", async () => {
  await withVault(async (url) => {
    for (
      const [at, type] of [
        ["/media/notes/art/shot.png", "image/png"],
        ["/media/notes/art/diagram.svg", "image/svg+xml"],
        ["/media/notes/q3.pdf", "application/pdf"],
        ["/media/notes/page.css", "text/css"],
        ["/media/notes/chart.js", "javascript"],
      ] as const
    ) {
      const answer = await fetch(`${url}${at}`)
      expect(answer.status).toBe(200)
      expect(answer.headers.get("content-type")).toContain(type)
    }
  })
})

test("the vault's other files are not served, however they are asked for", async () => {
  await withVault(async (url) => {
    for (
      const at of [
        "/media/notes/finishes.md",
        "/media/notes/sales.csv",
        "/media/a.olai",
        "/media/notes/secret.env",
        "/media/notes/nothing.html",
        "/media/../../etc/hostname",
        "/media/%2e%2e/%2e%2e/etc/hostname",
        "/media/notes/",
      ]
    ) {
      const answer = await askRaw(url, at)
      expect([answer.status, at]).toEqual([404, at])
    }
  })
})

test("an svg is served with a policy that makes it inert as a document", async () => {
  await withVault(async (url) => {
    const answer = await fetch(`${url}/media/notes/art/diagram.svg`)
    expect(answer.status).toBe(200)
    const policy = answer.headers.get("content-security-policy")
    expect(policy).toContain("sandbox")
    expect(policy).not.toContain("allow-scripts")
    expect(policy).toContain("default-src 'none'")
    expect(answer.headers.get("x-content-type-options")).toBe("nosniff")
    expect(await answer.text()).toContain("<script>top.x=1</script>")
  })
})

test("a raster picture is answered without the svg's policy, and with nosniff", async () => {
  await withVault(async (url) => {
    for (const at of ["/media/notes/art/shot.png", "/media/notes/q3.pdf", "/media/notes/page.css"]) {
      const answer = await fetch(`${url}${at}`)
      expect([at, answer.status]).toEqual([at, 200])
      expect([at, answer.headers.get("content-security-policy")]).toEqual([at, null])
      expect([at, answer.headers.get("x-content-type-options")]).toEqual([at, "nosniff"])
    }
  })
})

test("a `.html` under a file is a 404 and is not in the log", async () => {
  await withServing({ root: vault() }, async (url, said) => {
    const at = "/media/notes/finishes.md/x.html"
    const answer = await fetch(`${url}${at}`)
    expect(answer.status).toBe(404)
    expect(said.filter((line) => JSON.stringify(line).includes("x.html"))).toEqual([])
  })
})

test("a request whose host is not a host gets a policy that fetches nothing", async () => {
  await withVault(async (url) => {
    const answer = await fetch(`${url}/media/notes/report.html`, {
      headers: { host: "olai.test; img-src *" },
    })
    const policy = answer.headers.get("content-security-policy") ?? ""
    expect(policy).toContain("default-src 'none'")
    expect(policy).not.toContain("img-src *")
  })
})

test("a page that cannot be read says so, and IS in the log", async () => {
  if (typeof process.getuid === "function" && process.getuid() === 0) return
  const root = vault()
  const shut = path.join(root, "notes", "shut.html")
  fs.writeFileSync(shut, "<h1>Shut</h1>\n")
  fs.chmodSync(shut, 0o000)
  try {
    await withServing({ root }, async (url, said) => {
      const answer = await fetch(`${url}/media/notes/shut.html`)
      expect(answer.status).toBe(200)
      const body = await answer.text()
      expect(body).toContain(BODY_REFUSED)
      expect(body.indexOf("olai:page-sealed")).toBeLessThan(body.indexOf("<body"))
      const complaint = said.find((line) => line.annotations["file"] === "notes/shut.html")
      expect(complaint?.level).toBe("Warn")
      expect(complaint?.message).toContain("notes/shut.html")
    })
  } finally {
    fs.chmodSync(shut, 0o600)
  }
})
