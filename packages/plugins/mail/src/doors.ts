/**
 * THE ROW'S ENVIRONMENT DOORS, NAMED ONCE.
 *
 * Four variables are this plugin's whole configuration surface, and the names
 * used to be spelled in four code homes: the `environment` table the panel
 * draws (`./server.ts`), the `doorOf` reads beside it, the sentence the row
 * shows an operator when a connect cannot work (`./account.ts`), and the e2e
 * harness — both the env it hands a spawn and the host variables it strips
 * (`packages/tests/support/`). A door added in PR 2 (the tools' vault context,
 * the doorbell's knob) would have been four edits with nothing forcing them to
 * agree, and the worst of them fails silently: a variable the harness forgot to
 * strip is a scenario that reads a developer's real Gmail account.
 *
 * So the names live here — a leaf module importing NOTHING, the rule
 * `./himalaya/verbs.ts` and `./testids.ts` keep — and every reader derives from
 * it: the declaration, the reads, the operator's sentence, and the harness's
 * strip list, which goes through the appliance door this package already opens
 * for it. The names are the `OLAI_` family the rest of the product uses, and
 * the harness is the only thing that ever sets the last of them to somewhere
 * other than Google (`./oauth.ts` says why only loopback is honoured).
 */

export const DOOR = {
  /** The pinned binary, the plugin's own knob: see `./himalaya/run.ts`. */
  himalaya: "OLAI_HIMALAYA",
  /** The Google OAuth client this serve connects a mailbox with. */
  client: "OLAI_MAIL_OAUTH_CLIENT",
  /** ...and its secret, which is why neither is written to the vault. */
  secret: "OLAI_MAIL_OAUTH_SECRET",
  /** The Google origin. Loopback only, and unset in every deployment. */
  google: "OLAI_MAIL_GOOGLE",
} as const

/** EVERY DOOR THIS ROW READS, for a caller that sweeps them — the harness's
 *  strip list, and any future check that wants the surface rather than one
 *  name. */
export const DOORS: ReadonlyArray<string> = Object.values(DOOR)

/** ...AND THE TWO A CONNECT SPENDS, as the operator's own sentence: the row
 *  prints this when a connect cannot work, so the names a person reads are
 *  these names and never a second spelling of them. */
export const CREDENTIALS = `${DOOR.client} and ${DOOR.secret}`
