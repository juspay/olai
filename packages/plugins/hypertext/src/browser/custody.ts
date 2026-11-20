export type Arrival = "asked-for" | "unasked"

type Held =
  | { readonly at: "asked"; readonly spoke: boolean }
  | { readonly at: "showing"; readonly spoke: boolean }
  | { readonly at: "greeted" }
  | { readonly at: "stray"; readonly until: ReturnType<typeof setTimeout> }

export interface Custody {
  pointed(): void
  loaded(): Arrival
  greeted(): void
  release(): void
}

export const custody = (
  { helloMs, strayed }: { readonly helloMs: number; readonly strayed: () => void },
): Custody => {
  let held: Held = { at: "showing", spoke: true }
  const enter = (next: Held) => {
    if (held.at === "stray") clearTimeout(held.until)
    held = next
  }
  return {
    pointed() {
      enter({ at: "asked", spoke: false })
    },
    loaded() {
      if (held.at === "asked") {
        enter({ at: "showing", spoke: held.spoke })
        return "asked-for"
      }
      enter(
        held.at === "greeted"
          ? { at: "showing", spoke: true }
          : { at: "stray", until: setTimeout(strayed, helloMs) },
      )
      return "unasked"
    },
    greeted() {
      if (held.at === "stray") enter({ at: "showing", spoke: true })
      else if (held.at === "greeted") return
      else if (held.spoke) enter({ at: "greeted" })
      else enter({ ...held, spoke: true })
    },
    release() {
      enter({ at: "showing", spoke: true })
    },
  }
}
