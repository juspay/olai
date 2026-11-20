export const ACCOUNT = "olai"

export const CONFIG_FILE = "config.toml"

export const tomlString = (value: string): string =>
  `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")}"`

export interface ConfigInput {
  readonly token: string
  /** The address `gmail profile` reported, or `null` before the first profile
   *  call. Himalaya does not require it (the Gmail backend authenticates as the
   *  token's own user), so an account with no address yet still renders. */
  readonly address: string | null
}

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
