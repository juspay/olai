import { chmodSync, cpSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
export default {
  head: readFileSync(new URL("./head.html", import.meta.url), "utf8"),
  install: (distDir: string) => {
    const source = new URL("./public/", import.meta.url)
    for (const name of readdirSync(source)) {
      const destination = join(distDir, name)
      cpSync(new URL(name, source), destination)
      chmodSync(destination, 0o644)
    }
  },
}
