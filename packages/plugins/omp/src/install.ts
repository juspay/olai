/**
 * WHO THIS ENGINE IS, AND HOW A PERSON GETS IT — spelled once, spent once.
 *
 * THE BROWSER HALF IS THE ONE THAT SPENDS IT: {@link ./browser.tsx} hangs this
 * value in the `engine.install` slot, and `@olai/web` draws the row on the
 * face the panel shows when this machine has no agent at all. **The server half
 * does not touch it** — {@link ./server.ts} opens this module for {@link NAME}
 * and nothing else.
 *
 * A MODULE OF ITS OWN rather than lines inside `./browser.tsx`, because that
 * bench must not open the browser door: `packages/tests` runs under a process
 * with no browser in it, and a claim about two strings would drag SolidJS onto
 * its graph.
 *
 * IT IS A WHOLE SENTENCE and core composes no clause of it. **Core displays a
 * sentence and never composes one** — the reason there is no template with a
 * noun dropped into it: what an engine is and how you get it are facts only its
 * own package knows.
 */

import type { NotHere } from "@olai/plugin-api"

/** WHAT A PERSON READS. The engine's own name and not the plugin's word, and
 *  the two exist apart because they are different facts: the row is bound under
 *  `omp`, and the thing a person is being asked to install is called
 *  **Oh My Pi**. A `name` that merely capitalised the id would be a claim about
 *  that agent's branding that this package has no business making. */
export const NAME = "Oh My Pi"

/** ...AND WHAT A MACHINE THAT HAS NONE IS TOLD. Two clauses and both are this
 *  plugin's to word: where it comes from, and the one thing a person has to do
 *  about it. "On this server's PATH" rather than "on your PATH" because olai's
 *  PATH is not your shell's when it runs as a service, which is the trap this
 *  sentence exists to stay ahead of. */
export const INSTALL: NotHere = {
  name: NAME,
  where: "https://github.com/can1357/oh-my-pi",
  why: "put `omp` on this server's PATH",
}
