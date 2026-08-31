/**
 * The open/shut machine both chat pickers run on (`./inlinePicker.ts`), as its
 * transitions and as what it hands the dismissal.
 *
 * ## WHY THE DISMISSAL IS STUBBED, which is not a preference
 *
 * `./dismiss.ts` reaches Kobalte's two gesture primitives, and importing
 * `@kobalte/core` under the resolution `bun test` gives it — SolidJS's SERVER
 * build — throws where the library evaluates a client-only `template()` at
 * module scope. Nothing else in this client has a unit test that imports it, so
 * this is the first file to meet that wall. So the module is replaced before the
 * subject is loaded, and the test is BETTER for it rather than merely possible:
 * what the picker hands over is exactly the wiring the two call sites used to
 * spell twice, and a stub is the only way to read it back.
 *
 * The stub is safe because nothing else in this package imports `./dismiss.ts`
 * from a test — the day something does, it would get this one, and this comment
 * is where to start.
 *
 * ## AND WHAT IS STILL NOT HERE
 *
 * The GESTURES themselves. `bun test`'s resolution runs no effects, and both of
 * Kobalte's primitives are effects, so a case that pressed a pointer outside
 * would pass having listened to nothing. Those are pinned where they can happen,
 * in a browser: `features/the_agent.feature` holds the three ways out of the
 * conversations list, and `features/dismiss_stack.feature` holds which panel a
 * gesture is for.
 *
 * Nothing here asks what a picker LOOKS like. The classes, the anchoring and the
 * rows are the call sites' and are not this module's to have an opinion about.
 */

import { expect, mock, test } from "bun:test"
import { createRoot } from "solid-js"

import type { Dismissable } from "./dismiss.ts"
import type { InlinePicker } from "./inlinePicker.ts"

/** What the picker last handed the dismissal — the accessors it would answer a
 *  gesture with, and the shutting it would do. */
let wired: Dismissable | undefined

mock.module("./dismiss.ts", () => ({
  dismissOn: (on: Dismissable): void => {
    wired = on
  },
}))

// AFTER the stub, and that is the whole reason this import is dynamic: a static
// one is evaluated before anything in this file runs, and would load the real
// module — and its `@kobalte/core` — first.
const { createInlinePicker } = await import("./inlinePicker.ts")

/** An owner, because the state behind the list is a signal and Solid wants one.
 *  It is disposed at the end of every case, which is also what runs the
 *  cleanups the disposal case is about. */
const withPicker = <T>(
  opening: () => T,
  run: (
    picker: InlinePicker<T>,
    dismissal: Dismissable,
    dispose: () => void,
  ) => void,
): void => {
  createRoot((dispose) => {
    // Cleared first, so a case reads the dismissal THIS picker wired and never
    // the one before it.
    wired = undefined
    const picker = createInlinePicker({ opening })
    const dismissal = wired
    if (dismissal === undefined) throw new Error("the picker wired no dismissal")
    run(picker, dismissal, dispose)
    dispose()
  })
}

/** A control that counts the times the caret was handed back to it. Not an
 *  element: `focus()` is the whole of what this module asks of a trigger, and a
 *  DOM to hold one is exactly what this resolution has not got. */
const control = (): { readonly el: HTMLElement; readonly focused: () => number } => {
  let focused = 0
  return {
    el: { focus: () => { focused += 1 } } as unknown as HTMLElement,
    focused: () => focused,
  }
}

/** A stand-in for the list's own box, for the same reason. */
const box = (): HTMLElement => ({}) as HTMLElement

test("it rests SHUT, and a shut picker is up over nothing", () => {
  withPicker(() => "", (picker) => {
    expect(picker.open()).toBe(false)
    // The whole point of the union: there is no payload to read while it is
    // down, so there is none to read STALE.
    expect(picker.showing()).toBeUndefined()
  })
})

test("a press puts it up over what `opening` answers", () => {
  withPicker(() => "start here", (picker) => {
    picker.toggle()
    expect(picker.open()).toBe(true)
    expect(picker.showing()).toBe("start here")
  })
})

test("shutting cannot leave anything behind", () => {
  // The bug the one signal exists against: a list reopened still narrowed by
  // what somebody typed at it a conversation ago.
  withPicker(() => "", (picker) => {
    picker.toggle()
    picker.show("what was typed")
    picker.shut()
    expect(picker.open()).toBe(false)
    expect(picker.showing()).toBeUndefined()
    picker.toggle()
    expect(picker.showing()).toBe("")
  })
})

test("`opening` is asked at every press, not once", () => {
  // Which is what makes the fresh payload above a fact about the list a reader
  // sees rather than about the first time they opened it — and it is the door
  // the conversations picker starts its ask through.
  let presses = 0
  withPicker(() => ++presses, (picker) => {
    picker.toggle()
    expect(picker.showing()).toBe(1)
    picker.toggle()
    picker.toggle()
    expect(picker.showing()).toBe(2)
  })
})

test("showing something again replaces what it is up over", () => {
  withPicker(() => "", (picker) => {
    picker.toggle()
    picker.show("a")
    picker.show("b")
    expect(picker.showing()).toBe("b")
    expect(picker.open()).toBe(true)
  })
})

test("a press that CLOSES hands the caret back to the trigger", () => {
  // A press of the trigger while the list is up is a dismissal a keyboard can
  // reach, and no dismissal can see it: it lands on the trigger, which is inside
  // as far as `./dismiss.ts` is concerned.
  withPicker(() => "", (picker) => {
    const trigger = control()
    picker.setTrigger(trigger.el)
    picker.toggle()
    expect(trigger.focused()).toBe(0)
    picker.toggle()
    expect(trigger.focused()).toBe(1)
  })
})

test("...and `shut` on its own does not touch the caret", () => {
  // Where the caret goes is the caller's, and there are only two callers: the
  // dismissal, which hands it back for the key and leaves it alone for the
  // press, and the trigger above. A row picked out of the list shuts it without
  // moving anybody's focus.
  withPicker(() => "", (picker) => {
    const trigger = control()
    picker.setTrigger(trigger.el)
    picker.toggle()
    picker.shut()
    expect(trigger.focused()).toBe(0)
  })
})

test("a picker with no trigger yet still opens and shuts", () => {
  // A ref is called when its element attaches, and a toggle is reachable before
  // that has happened — which must not be the throw that takes the panel with
  // it.
  withPicker(() => "", (picker) => {
    picker.toggle()
    picker.toggle()
    expect(picker.open()).toBe(false)
  })
})

test("BOTH ROOTS go to the dismissal: the list, and the trigger that is not in it", () => {
  // The bug this half exists against: the list is a sibling of the button rather
  // than a child of it, so a click-away told only about the list reads a press
  // of the trigger as a press outside — shutting on the pointerdown and reopened
  // by that same press's click.
  withPicker(() => "", (picker, dismissal) => {
    const trigger = control()
    const list = box()
    picker.setTrigger(trigger.el)
    picker.setList(list)
    expect(dismissal.root()).toBe(list)
    expect(dismissal.trigger?.()).toBe(trigger.el)
  })
})

test("the dismissal listens only while the list is up, and its shutting is the picker's", () => {
  withPicker(() => "typed", (picker, dismissal) => {
    expect(dismissal.open()).toBe(false)
    picker.toggle()
    expect(dismissal.open()).toBe(true)
    // What `dismiss` means here is the same `shut` a press means, payload and
    // all — the caret it does or does not hand back is the dismissal's own.
    dismissal.dismiss()
    expect(picker.open()).toBe(false)
    expect(picker.showing()).toBeUndefined()
  })
})

test("a list that has gone is one the dismissal is no longer told about", () => {
  // The disposal, and why the ref carries one: Solid never calls a ref with
  // `undefined` and the list lives inside a `<Show>`, so without this a shut
  // picker keeps its detached box and answers a gesture with an element that is
  // no longer on the page.
  withPicker(() => "", (picker, dismissal, dispose) => {
    picker.setList(box())
    expect(dismissal.root()).toBeDefined()
    dispose()
    expect(dismissal.root()).toBeUndefined()
  })
})
