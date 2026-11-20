import { Data, Effect, FileSystem } from "effect"

const DIST_ENV_VAR = "OLAI_DIST_DIR"

class MissingBundle extends Data.TaggedError("MissingBundle")<{
  readonly message: string
}> {}

export const clientDist = Effect.gen(function*() {
  const dist = process.env[DIST_ENV_VAR]
  if (dist === undefined || dist === "") {
    return yield* new MissingBundle({
      message:
        `${DIST_ENV_VAR} is not set, so there is no browser bundle to serve. Run \`just serve <dir>\`, which builds one and sets it — or set it yourself to a directory built by \`just build-client\`.`,
    })
  }

  const fs = yield* FileSystem.FileSystem
  if (!(yield* fs.exists(`${dist}/index.html`))) {
    return yield* new MissingBundle({
      message: `${DIST_ENV_VAR} is ${dist}, which holds no index.html — it points at an unbuilt directory.`,
    })
  }
  return dist
})
