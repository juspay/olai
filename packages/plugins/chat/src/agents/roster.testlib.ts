import type { Installed, Standing } from "./roster.ts"

/** A here row for panel benches; probe policy belongs to the roster's own bench. */
export const seated = (installed: Installed): Standing => ({ standing: "here", installed })
