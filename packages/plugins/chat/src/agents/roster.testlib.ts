import type { Installed, Standing } from "./roster.ts"

export const seated = (installed: Installed): Standing => ({ standing: "here", installed })
