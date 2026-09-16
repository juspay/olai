import { TESTID } from "olai-plugin-chat/testids"
import { createInlinePicker } from "@olai/web/client/inlinePicker.ts"
import { folded, matchFiles } from "@olai/web/client/file/matching.ts"
import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { WITHIN } from "@olai/web/client/layer.ts"
import { createMemo, createSignal } from "solid-js"
import { Effect } from "effect"
import { fileKind, isPutAway, inOlaiDir } from "@olai/format"
import { FileWake } from "@olai/ui-primitives/FileWake.tsx"
import type { Directory } from "olai-plugin-vault/file-state"
import type { WakeContext } from "olai-plugin-chat/slots"
import { wake } from "../wake.ts"

export function Wake(props: { context: WakeContext; directory: Directory }) {
  const [problem, setProblem] = createSignal<string>()
  const file = () => typeof props.context.pick() === "string" ? props.context.pick() as string : null
  const paths = () => props.directory.paths()
  const claims = () => props.directory.claims()
  const picker = createInlinePicker<string>({ opening: () => "" })
  const offerable = createMemo(() => !picker.open() ? [] : folded(paths()).filter(one => claims().byKind.get(fileKind(claims(), one.path) ?? "")?.holds === "nodes" && !isPutAway(claims(), one.path) && !inOlaiDir(one.path)))
  const offered = createMemo(() => matchFiles(offerable(), picker.showing() ?? "", 12).map(one => one.path))
  return <FileWake plugin="odu" subject={wake.subject} from="runs from" file={file()}
    fault={file() === null ? null : !paths().includes(file()!) ? "gone" : claims().byKind.get(fileKind(claims(), file()!) ?? "")?.holds !== "nodes" ? "unwatchable" : null}
    paths={offered()} picker={picker} triggerClass={QUIET_PILL}
    listClass={`absolute inset-x-3 top-full ${WITHIN.pop} mt-1 max-h-80 overflow-x-hidden overflow-y-auto rounded border border-rule/70 bg-panel p-1 shadow-lg`}
    ids={{ picker: TESTID.chatWakePicker, fault: TESTID.chatWakeFault, clear: TESTID.chatWakeClear, list: TESTID.chatWakeList, query: TESTID.chatWakeQuery, file: TESTID.chatWakeFile }}
    problem={problem()} setPick={next => { setProblem(undefined); Effect.runFork(props.context.setPick(next).pipe(Effect.catch(error => Effect.sync(() => setProblem(error.reason))))) }} />
}
