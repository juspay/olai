import { expect, test } from "bun:test"
import { followLayout } from "./layout-press.ts"
import { atFile } from "./routes.ts"
import { panesOf, type Workspace } from "./workspace.ts"

const first = atFile("house.olai")
const second = atFile("garden.olai")
const workspace: Workspace = {
  layout: { kind: "split", axis: "col", children: [
    { layout: { kind: "leaf", route: first }, fraction: 20 },
    { layout: { kind: "leaf", route: second }, fraction: 80 },
  ] },
  focus: 1,
}

for (const modifiers of [{}, { altKey: true }, { shiftKey: true }, { altKey: true, shiftKey: true }]) {
  test(`layout press opens once without a URL codec: ${JSON.stringify(modifiers)}`, () => {
    const opened: Workspace[] = []
    let prevented = 0
    followLayout({ open: next => { opened.push(next) } }, workspace, {
      button: 0, metaKey: false, ctrlKey: false, defaultPrevented: false,
      ...modifiers, preventDefault: () => { prevented++ },
    })
    expect(prevented).toBe(1)
    expect(opened).toHaveLength(1)
    expect(opened[0]?.focus).toBe(0)
    const panes = panesOf(opened[0]!)
    expect(panes.map(pane => pane.width)).toEqual([undefined, undefined])
    // Preserve the parsed route values; opening needs no serialize/parse cycle.
    expect(panes[0]?.route).toBe(first)
    expect(panes[1]?.route).toBe(second)
    expect(workspace.focus).toBe(1)
  })
}

for (const ignored of [{ metaKey: true }, { ctrlKey: true }, { button: 1 }, { button: 2 }, { defaultPrevented: true }]) {
  test(`layout press leaves a browser or already claimed gesture alone: ${JSON.stringify(ignored)}`, () => {
    const unexpected = () => { throw new Error("gesture was already owned") }
    followLayout({ open: unexpected }, workspace, {
      button: 0, metaKey: false, ctrlKey: false, defaultPrevented: false,
      ...ignored, preventDefault: unexpected,
    })
  })
}
