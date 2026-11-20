import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

export const name = "mail"

export const SCOPE = "https://www.googleapis.com/auth/gmail.modify"

export const REDIRECT_PATH = "/_olai/mail/oauth"

export const AccountStatus = Schema.Literals(["absent", "connected", "fault"])
export type AccountStatus = typeof AccountStatus.Type

export const Account = Schema.Struct({
  status: AccountStatus,
  address: Schema.NullOr(Schema.String),
  messages: Schema.NullOr(Schema.Number),
  refreshedAt: Schema.NullOr(Schema.String),
  scope: Schema.String,
  redirect: Schema.String,
  reason: Schema.NullOr(Schema.String),
  retrying: Schema.Boolean,
  canConnect: Schema.Boolean,
})
export type Account = typeof Account.Type

export const MAIL_UNCONNECTED: Account = {
  status: "absent",
  address: null,
  messages: null,
  refreshedAt: null,
  scope: SCOPE,
  redirect: "",
  reason: null,
  retrying: false,
  canConnect: false,
}

export const sameAccount: (a: Account, b: Account) => boolean = Schema.toEquivalence(Account)

export class MailRefusal extends Schema.TaggedError<MailRefusal>(
  "@olai/plugin-mail/MailRefusal",
)("MailRefusal", { reason: Schema.String }) {
  override get message(): string {
    return this.reason
  }
}

export const ConnectBegun = Schema.Struct({ url: Schema.String })

export const surface = defineSurface({
  cells: {
    account: {
      schema: Account,
      default: MAIL_UNCONNECTED,
      verbs: ["get"],
      equals: sameAccount,
    },
  },
  procedures: {
    connect: {
      begin: {
        input: Schema.Struct({ origin: Schema.String }),
        output: ConnectBegun,
        error: MailRefusal,
      },
      disconnect: {
        output: Schema.Struct({}),
        error: MailRefusal,
      },
    },
  },
})

export const faces = {
  browser: {
    account: "resource",
    "connect.begin": { tool: { mutates: true } },
    "connect.disconnect": { tool: { mutates: true } },
  },
} as const
