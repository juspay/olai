import { dlopen, FFIType } from "bun:ffi"

export const DIE_WITH_PARENT = "OLAI_DIE_WITH_PARENT"

const PR_SET_PDEATHSIG = 1
const SIGTERM = 15

export type ParentTie =
  | { readonly parent: number }
  | { readonly parent: null; readonly complaint?: string }

export const parentTie = (env: NodeJS.ProcessEnv): ParentTie => {
  const raw = env[DIE_WITH_PARENT]
  if (raw === undefined || raw === "") return { parent: null }
  const asked = Number(raw)
  if (!/^[0-9]+$/.test(raw) || !Number.isSafeInteger(asked) || asked < 1) {
    return {
      parent: null,
      complaint:
        `olai: ignoring ${DIE_WITH_PARENT}=${raw} — it must be the spawning ` +
        `process's own pid (\`${DIE_WITH_PARENT}=$$\`); not dying with any parent`,
    }
  }
  return { parent: asked }
}

export const dieWithParent = (env: NodeJS.ProcessEnv = process.env): void => {
  const tie = parentTie(env)
  delete env[DIE_WITH_PARENT]
  if (tie.parent === null) {
    if (tie.complaint !== undefined) process.stderr.write(`${tie.complaint}\n`)
    return
  }
  if (process.platform !== "linux") return
  // The sonames, glibc's then musl's.
  for (const name of ["libc.so.6", "libc.so"] as const) {
    try {
      const lib = dlopen(name, {
        prctl: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
      })
      const armed = lib.symbols.prctl(PR_SET_PDEATHSIG, SIGTERM)
      if (armed !== 0) {
        process.stderr.write(
          `olai: tied to pid ${tie.parent} (${DIE_WITH_PARENT}), but ` +
            `prctl(PR_SET_PDEATHSIG) returned ${armed} — nothing will tell this ` +
            `process when that parent dies\n`,
        )
      }
      // The kernel delivers nothing for a parent that died BEFORE the arm, so
      // the ppid is read back after it.
      if (process.ppid !== tie.parent) process.kill(process.pid, "SIGTERM")
      return
    } catch {
    }
  }
  process.stderr.write(
    `olai: tied to pid ${tie.parent} (${DIE_WITH_PARENT}), but libc would not ` +
      `load — PR_SET_PDEATHSIG is not armed and this process can outlive it\n`,
  )
}
