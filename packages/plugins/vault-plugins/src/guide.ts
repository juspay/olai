/**
 * HOW TO WRITE A PLUGIN, SHIPPED IN THE BINARY — what `vault-plugins_guide`
 * answers, and the reason an agent in somebody's vault can write a correct one.
 *
 * ## The hole this fills
 *
 * An agent building a plugin is working in a DIRECTORY, not in a checkout of
 * olai. It cannot open `website/docs/dynamic-plugins.md`; it has never seen this
 * repository; and what it knows about olai's plugin API is whatever was in its
 * training data, which is a memory of some other version. So the first
 * instruction every other verb here gives — *read the guide first* — named
 * something no agent could reach, and an agent that cannot reach it writes
 * plausible code against an API that does not exist.
 *
 * ## ONE SOURCE OF TRUTH, and the enforcement rather than the promise
 *
 * The pages a person reads are `website/docs/dynamic-plugins.md` and, beside it,
 * `website/docs/dynamic-plugins-examples.md`. The bytes an agent is handed are
 * `./guide.md`, beside this file, because a `website/docs/` directory is not in the
 * binary and a plugin package may not reach across the tree to read one. They
 * are the same text, and `./guide.test.ts` is why: it cuts each page's region
 * between `<!-- guide:start -->` and `<!-- guide:end -->`, joins the two in
 * page order, and asserts the result is byte for byte what is shipped here,
 * with the one command that fixes a difference in its failure message.
 *
 * TWO REGIONS RATHER THAN ONE because the docs are two pages: how to write a
 * plugin, and two worked ones. An agent needs both — a guide with no worked
 * example is advice nobody can follow — and one contiguous slice of one page
 * would mean putting the examples back into a page the writing standard
 * already split for length.
 *
 * Two authoring guides drift, and the one that drifts is always the one nobody
 * reads — which here would be the one every agent reads. So the drift is a red
 * test on the same afternoon rather than wrong advice a year later.
 *
 * ## Read at module load, through the URL of this module
 *
 * The shape `olai-plugin-theme`'s `assets.ts` and `olai-plugin-web-app`'s use
 * for the files they ship: `new URL("./guide.md", import.meta.url)` is a path
 * in a checkout and an embedded asset in a compiled binary, so one expression
 * answers for both and nothing has to know which it is running in.
 */

import { readFileSync } from "node:fs"

/** The guide, as an agent reads it. */
export const GUIDE: string = readFileSync(new URL("./guide.md", import.meta.url), "utf8").trim()

/** The markers the doc puts around the region this file is cut from — spelled
 *  here because the test that keeps the two in step reads them from the module
 *  that is about the guide, and a doc that grew a start and lost an end should
 *  fail loudly rather than ship a whole page as advice. */
export const GUIDE_START = "<!-- guide:start -->"
export const GUIDE_END = "<!-- guide:end -->"
