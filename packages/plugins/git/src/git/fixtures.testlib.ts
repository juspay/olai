import { execFileSync } from "node:child_process"

/** Env beats config, and an empty `GIT_AUTHOR_NAME` is set-but-empty, which
 *  gives `fatal: empty ident name` however the repository's `user.name` reads. */
export const GIT_IDENT = {
  GIT_AUTHOR_NAME: "olai tests",
  GIT_AUTHOR_EMAIL: "test@olai.invalid",
  GIT_COMMITTER_NAME: "olai tests",
  GIT_COMMITTER_EMAIL: "test@olai.invalid",
} as const

export const GIT_IDENT_KEYS = Object.keys(GIT_IDENT) as ReadonlyArray<
  keyof typeof GIT_IDENT
>

export const gitIn = (root: string) =>
(...argv: ReadonlyArray<string>): string =>
  execFileSync("git", argv, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...GIT_IDENT },
  })

/** `init.defaultBranch` varies per machine, so the branch is named explicitly. */
export const repoAt = (
  root: string,
  options: {
    readonly identity?: boolean
    readonly seed?: boolean
    readonly message?: string
  } = {},
): void => {
  const git = (argv: ReadonlyArray<string>, env?: Record<string, string>) => {
    execFileSync("git", argv, {
      cwd: root,
      stdio: "ignore",
      env: { ...process.env, ...GIT_IDENT, ...env },
    })
  }
  const nobody = options.identity === false
  git(["init", "--quiet", "--initial-branch", "main"])
  git(["config", "user.email", nobody ? "" : GIT_IDENT.GIT_AUTHOR_EMAIL])
  git(["config", "user.name", nobody ? "" : GIT_IDENT.GIT_AUTHOR_NAME])
  if (options.seed === false) return
  git(["add", "-A"])
  git(["commit", "--quiet", "--no-verify", "-m", options.message ?? "fixtures"])
}

export const subjectsIn = (root: string): ReadonlyArray<string> =>
  gitIn(root)("log", "--format=%s").trim().split("\n")

export const writerOf = (root: string): string =>
  gitIn(root)("log", "-1", "--format=%(trailers:key=X-Olai-Writer,valueonly)").trim()

export const isRoot = (): boolean =>
  typeof process.getuid === "function" && process.getuid() === 0
