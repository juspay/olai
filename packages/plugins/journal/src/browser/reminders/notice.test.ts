import { expect, test } from "bun:test"
import { noticeOf } from "./notice.ts"

test("one daily tag, the deployment's word, the entry's phrase and no dated payload", () => {
  for (const [owed, phrase] of [
    [{ overdue: 2, today: 0 }, "2 overdue"],
    [{ overdue: 0, today: 3 }, "3 on today"],
    [{ overdue: 2, today: 3 }, "2 overdue, 3 on today"],
  ] as const) {
    expect(noticeOf("2026-09-11", owed, "olai [box]")).toEqual({
      tag: "olai:due:2026-09-11", title: "olai [box]", body: `Agenda: ${phrase}`, data: { kind: "due" },
    })
    expect(noticeOf("2026-09-12", owed).title).toBe("olai")
    expect(noticeOf("2026-09-12", owed).tag).toBe("olai:due:2026-09-12")
  }
})
