import { expect, test } from "bun:test"

import { parseFilter } from "@olai/format"

import { FILTER_FORMS } from "./forms.ts"

test("every form the hint offers is one the filter takes", () => {
  for (const { form } of FILTER_FORMS) {
    expect({ form, kind: parseFilter(form, "2026-09-28T12:00:00Z").kind }).not.toEqual({ form, kind: "refused" })
  }
})

test("each form selects the part a person replaces, or puts the caret after it", () => {
  const selected = Object.fromEntries(FILTER_FORMS.map(({ form, select }) => [form, form.slice(...select)]))
  expect(selected).toEqual({
    words: "words",
    "\"a phrase\"": "a phrase",
    "a OR b": "a OR b",
    "#tag": "tag",
    "is:done": "",
    "has:desc": "",
    "date:last-week": "last-week",
    "changed:today": "today",
    "-not": "not",
  })
})
