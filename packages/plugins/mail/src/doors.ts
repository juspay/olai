export const DOOR = {
  himalaya: "OLAI_HIMALAYA",
  client: "OLAI_MAIL_OAUTH_CLIENT",
  secret: "OLAI_MAIL_OAUTH_SECRET",
  google: "OLAI_MAIL_GOOGLE",
} as const

export const DOORS: ReadonlyArray<string> = Object.values(DOOR)

export const CREDENTIALS = `${DOOR.client} and ${DOOR.secret}`
