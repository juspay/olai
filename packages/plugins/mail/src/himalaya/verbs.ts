// himalaya 2.1.0 is the release that introduced the `gmail` backend: 2.0.0
// answers every verb below with *unrecognized subcommand*.
export const HIMALAYA_VERSION_FLOOR: readonly [number, number, number] = [2, 1, 0]

export interface GmailVerb {
  readonly id: string
  readonly path: ReadonlyArray<string>
  readonly says: string
}

export const GMAIL = {
  profileGet: {
    id: "profile.get",
    path: ["gmail", "profile", "get"],
    says: "the signed-in address and the mailbox's totals",
  },
  historyList: { id: "history.list", path: ["gmail", "history", "list"], says: "mailbox changes since a history id" },
  threadsList: { id: "threads.list", path: ["gmail", "threads", "list"], says: "a page of matching Gmail threads" },
  threadsGet: { id: "threads.get", path: ["gmail", "threads", "get"], says: "the messages and labels of one thread" },
  threadsModify: { id: "threads.modify", path: ["gmail", "threads", "modify"], says: "add or remove labels across a thread" },
  threadsTrash: { id: "threads.trash", path: ["gmail", "threads", "trash"], says: "move a thread to Gmail Trash" },
  threadsUntrash: { id: "threads.untrash", path: ["gmail", "threads", "untrash"], says: "restore a thread from Gmail Trash" },
  draftsCreate: { id: "drafts.create", path: ["gmail", "drafts", "create"], says: "create a draft for the person to send" },
  draftsUpdate: { id: "drafts.update", path: ["gmail", "drafts", "update"], says: "replace a draft for the person to send" },
  labelsList: { id: "labels.list", path: ["gmail", "labels", "list"], says: "the mailbox label ids and displayed names" },
  attachmentsGet: { id: "attachments.get", path: ["gmail", "attachments", "get"], says: "save one message attachment to a file" },
} as const satisfies Record<string, GmailVerb>

export const GMAIL_VERBS: ReadonlyArray<GmailVerb> = Object.values(GMAIL)

// `-c` and `--json` are clap global flags, which must precede the subcommand
// words.
export const himalayaArgv = (config: string, path: ReadonlyArray<string>, args: ReadonlyArray<string>): ReadonlyArray<string> =>
  ["-c", config, "--json", ...path, ...args]
