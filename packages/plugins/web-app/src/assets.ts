/** Stable install assets are supplied by the web-app row, alongside the
 * manifest that names them. The generic builder knows neither names nor paths. */
import { cpSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
export default {
  head: readFileSync(new URL("./head.html", import.meta.url), "utf8"),
  install: (distDir: string) => {
    const source = new URL("./public/", import.meta.url)
    for (const name of readdirSync(source)) cpSync(new URL(name, source), join(distDir, name))
  },
}
