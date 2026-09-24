import { expect, test } from "bun:test"
import { storyOf } from "./story.ts"

test("each tool story is derived from reply JSON, including refusal and no-op", () => {
  const examples = [
    [{ mail: "draft", to: ["ravi@example.com"], subject: "Hello" }, "draft to ravi@example.com · Hello"],
    [{ mail: "draft", to: ["ravi@example.com"], subject: "Hello", attachments: [] }, "draft to ravi@example.com · Hello"],
    [{ mail: "draft", to: ["ravi@example.com"], subject: "Hello", attachments: [{ filename: "invoice.pdf" }] }, "draft to ravi@example.com · Hello · 1 attachment"],
    [{ mail: "draft", to: ["ravi@example.com"], subject: "Hello", attachments: [{ filename: "a.pdf" }, { filename: "b.txt" }, { filename: "c.png" }] }, "draft to ravi@example.com · Hello · 3 attachments"],
    [{ mail: "draft_update", to: ["ravi@example.com"], subject: "Hello" }, "draft updated · Hello"],
    [{ mail: "draft_update", to: ["ravi@example.com"], subject: "Hello", attachments: [{ filename: "a.pdf" }, { filename: "b.txt" }] }, "draft updated · Hello · 2 attachments"],
    [{ mail: "inbox", threads: [1, 2, 3] }, "3 threads in INBOX"],
    [{ mail: "search", threads: [1], query: "is:unread" }, '1 threads for "is:unread"'],
    [{ mail: "thread", subject: "Invoice", messages: [{ from: "Ravi" }] }, "Invoice · Ravi · 1 messages"],
    [{ mail: "attachment", filename: "invoice.pdf", bytes: 12288 }, "invoice.pdf · 12 KiB"],
    [{ mail: "attachment", filename: "invoice.pdf", bytes: 13000 }, "invoice.pdf · 12.7 KiB"],
    [{ mail: "archive", changed: { added: [], removed: ["INBOX"] } }, "archived · −INBOX"],
    [{ mail: "trash", changed: { added: ["TRASH"], removed: [] } }, "trashed · +TRASH"],
    [{ mail: "untrash", changed: { added: [], removed: ["TRASH"] } }, "restored from Trash · −TRASH"],
    [{ mail: "label", changed: { added: ["waiting"], removed: ["INBOX"] } }, "+waiting −INBOX"],
    [{ mail: "read", changed: { added: [], removed: ["UNREAD"] } }, "marked read"],
    [{ reason: "connect one" }, "connect one"],
    [{ mail: "read", changed: { added: [], removed: [] } }, "nothing changed"],
  ] as const
  for (const [reply, text] of examples) expect(storyOf(reply)?.text).toBe(text)
})

test("incomplete or unrelated stored replies do not break the transcript", () => {
  for (const reply of [null, [], {}, { mail: "inbox" }, { mail: "thread", messages: null }, { mail: "label", changed: { added: null } }, { mail: "unknown" }]) expect(storyOf(reply)).toBeNull()
})
