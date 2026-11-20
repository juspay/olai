import { expect, mock, test } from "bun:test"
import { createRoot } from "solid-js"

import type { Dismissable } from "./dismiss.ts"
import type { InlinePicker, PickerSeat, PickerState } from "./inlinePicker.ts"

let wired: Dismissable | undefined

mock.module("./dismiss.ts", () => ({
  dismissOn: (on: Dismissable): void => {
    wired = on
  },
}))

const { createInlinePicker } = await import("./inlinePicker.ts")

const withPicker = <T>(
  opening: () => T,
  run: (
    picker: InlinePicker<T>,
    dismissal: Dismissable,
    dispose: () => void,
  ) => void,
  seat?: PickerSeat<T>,
): void => {
  createRoot((dispose) => {
    wired = undefined
    const picker = createInlinePicker({ opening }, seat)
    const dismissal = wired
    if (dismissal === undefined) throw new Error("the picker wired no dismissal")
    run(picker, dismissal, dispose)
    dispose()
  })
}

const control = (): { readonly el: HTMLElement; readonly focused: () => number } => {
  let focused = 0
  return {
    el: { focus: () => { focused += 1 } } as unknown as HTMLElement,
    focused: () => focused,
  }
}

const box = (): HTMLElement => ({}) as HTMLElement

test("it rests SHUT, and a shut picker is up over nothing", () => {
  withPicker(() => "", (picker) => {
    expect(picker.open()).toBe(false)
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
  withPicker(() => "", (picker) => {
    const trigger = control()
    picker.setTrigger(trigger.el)
    picker.toggle()
    picker.shut()
    expect(trigger.focused()).toBe(0)
  })
})

test("`focusTrigger` is the caret handed back for a take", () => {
  withPicker(() => "", (picker) => {
    const trigger = control()
    picker.setTrigger(trigger.el)
    picker.toggle()
    picker.shut()
    expect(trigger.focused()).toBe(0)
    picker.focusTrigger()
    expect(trigger.focused()).toBe(1)
  })
})

test("a picker with no trigger yet still opens and shuts", () => {
  withPicker(() => "", (picker) => {
    picker.toggle()
    picker.toggle()
    expect(picker.open()).toBe(false)
  })
})

test("the list's element is the picker's own to hand out, while it is on the page", () => {
  withPicker(() => "", (picker) => {
    expect(picker.list()).toBeUndefined()
    const el = box()
    picker.setList(el)
    expect(picker.list()).toBe(el)
  })
})

test("BOTH ROOTS go to the dismissal: the list, and the trigger that is not in it", () => {
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
    dismissal.dismiss()
    expect(picker.open()).toBe(false)
    expect(picker.showing()).toBeUndefined()
  })
})

test("a list that has gone is one the dismissal is no longer told about", () => {
  withPicker(() => "", (picker, dismissal, dispose) => {
    picker.setList(box())
    expect(dismissal.root()).toBeDefined()
    dispose()
    expect(dismissal.root()).toBeUndefined()
  })
})

test("a SEAT keeps the list up across the component that drew it", () => {
  let state: PickerState<string> = { _tag: "shut" }
  const seat: PickerSeat<string> = {
    read: () => state,
    write: (up) => { state = up },
  }
  withPicker(() => "the query", (first) => {
    first.toggle()
    expect(first.showing()).toBe("the query")
  }, seat)
  withPicker(() => "a fresh ask", (second) => {
    expect(second.open()).toBe(true)
    expect(second.showing()).toBe("the query")
    second.shut()
    expect(second.showing()).toBeUndefined()
  }, seat)
})
