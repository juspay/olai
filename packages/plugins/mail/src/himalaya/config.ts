/**
 * THE HIMALAYA CONFIG THIS PLUGIN WRITES — one account, one token, one file.
 *
 * ## Why olai writes a config at all
 *
 * Himalaya is not configured here and never read from here:
 * `~/.config/himalaya/config.toml` is a person's file, olai does not touch it,
 * and a serve whose only credential is a refresh token in olai's own state
 * directory could not use it anyway. So the plugin renders a config of its own,
 * hands it to the pinned binary with `-c`, and keeps it in a private temporary
 * directory that dies with the plugin's scope. What that buys is stated in the
 * issue that ruled it: no `which himalaya`, no `HIMALAYA_CONFIG` a person can
 * point somewhere, no second source of truth about which account a
 * conversation is reading.
 *
 * ## The shape, and how each line was established
 *
 * Against the pinned binary itself: `himalaya -c <this file> gmail profile get
 * --json` reaches the Gmail API (a fake token answers `HTTP 401` from Google,
 * which is a parsed config and a bad credential, exactly what a correct file
 * and a wrong token should produce). The keys are the sample's own —
 * `config.sample.toml` in the pin, section "Gmail config" — with
 * `gmail.auth.token.raw` carrying the SHORT-LIVED OAuth access token, which is
 * the only kind of credential this backend takes: refreshing it is olai's job
 * (`./../account.ts`), and the binary is told a token and nothing else.
 *
 * A file whose whole content is derived from two strings is worth a module
 * rather than a template in the runner for one reason: the TOKEN IS
 * UNTRUSTED as far as this function is concerned (it arrives over HTTP from
 * Google) and a TOML file assembled by string concatenation is a file whose
 * content can be changed by its own value. {@link tomlString} is the escape.
 */

/** The account name inside the rendered file. Not a person's choice and not
 *  read back: the file holds exactly one account and marks it `default`, so
 *  `-a` is never needed and no name this plugin invents can collide with one a
 *  human wrote somewhere else. */
export const ACCOUNT = "olai"

/** What the file is called inside the temporary directory. */
export const CONFIG_FILE = "config.toml"

/** One TOML basic string, with the four characters that can end one escaped.
 *  Written out rather than reached for from a package: this is the whole of the
 *  TOML this plugin emits, and a dependency for four `replace` calls would be a
 *  dependency on a parser it does not need. */
export const tomlString = (value: string): string =>
  `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")}"`

export interface ConfigInput {
  /** A Gmail OAuth access token, as `refreshToken`'s exchange answered. */
  readonly token: string
  /** The address `gmail profile` reported, or `null` before the first profile
   *  call. Himalaya does not require it (the Gmail backend authenticates as the
   *  token's own user), so an account with no address yet still renders. */
  readonly address: string | null
}

/**
 * The file. `user-id = "me"` is the Gmail backend's default and is written out
 * anyway: the sample names it, and a config that leans on a default is a config
 * whose behaviour moves when a default does.
 */
export const renderConfig = (input: ConfigInput): string =>
  `# Written by olai's mail plugin. Regenerated whenever the access token moves.
# Not a file to edit: it lives in a temporary directory of the serving process.

[accounts.${ACCOUNT}]
default = true
backend = "gmail"
${input.address === null ? "" : `email = ${tomlString(input.address)}\n`}
[accounts.${ACCOUNT}.gmail]
user-id = "me"
auth.token.raw = ${tomlString(input.token)}
`
