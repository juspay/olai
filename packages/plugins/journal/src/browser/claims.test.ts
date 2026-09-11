/** Claims over production code, with comments stripped: a new speller fails
 * with its filename. Tests quote these spellings to assert the vocabulary. */
import { expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

const sources = readdirSync(import.meta.dirname, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.(test|browsertest)\./.test(entry.name))
  .map(entry => join(entry.parentPath, entry.name))
  .map(file => ({ file: relative(import.meta.dirname, file), code: readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, (_taken, lead) => lead ?? "") }))
const spellers = (pattern: RegExp) => sources.filter(source => pattern.test(source.code)).map(source => source.file).sort()

test("reminders read the clock and owed stream, never the window or a second clock", () => {
  const reminders = sources.filter(source => source.file.startsWith("reminders/"))
  expect(reminders.length).toBeGreaterThan(0)
  expect(reminders.filter(source => /setTimeout\s*\(|setInterval\s*\(|hasFocus|visibilityState|visibilitychange|BroadcastChannel|["'](?:focus|blur)["']|\bwear\s*\(|setTabWaiting|chrome\.waiting/.test(source.code)).map(source => source.file)).toEqual([])
})

test("the notification tag has one speller", () => {
  expect(spellers(/olai:due:/)).toEqual(["reminders/notice.ts"])
})

test("the daily record has no writer before the circuit is installed", () => {
  expect(spellers(/olai\.reminders\.said/)).toEqual([])
})
