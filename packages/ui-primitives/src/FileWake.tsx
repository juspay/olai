/**
 * A pure file picker: its owner supplies paths, labels, status and the write.
 *
 * IT DRAWS NO TOOLTIP OF ITS OWN, and the reason is this package's manifest:
 * `@olai/ui-primitives` declares `solid-js` and nothing else, while the app's
 * tip lives in `@olai/web` — which depends on this package. So the rule the
 * rest of the app follows (whoever renders the control renders its tip) lands
 * on the HOST here. A rail button's host can simply wrap it; this one cannot,
 * because the control the sentence is about is the trigger INSIDE this
 * component, so the host hands its tip in as {@link FileWake.tip} instead.
 * That is the same rule, not a second one: the tip is still drawn by the
 * nearest owner that is allowed to know what a tip is.
 */
import { For, type JSX, Show } from "solid-js"
export function FileWake(props: {
  readonly plugin: string
  readonly subject: string
  readonly from: string
  readonly file: string | null
  readonly fault: "gone" | "unwatchable" | null
  readonly paths: ReadonlyArray<string>
  readonly setPick: (file: string | null) => void
  readonly ids: { readonly picker: string; readonly fault: string; readonly clear: string; readonly list: string; readonly query: string; readonly file: string }
  readonly picker: { readonly open: () => boolean; readonly showing: () => string | undefined; readonly show: (query: string) => void; readonly shut: () => void; readonly toggle: () => void; readonly setTrigger: (element: HTMLElement) => void; readonly setList: (element: HTMLElement) => void }
  readonly triggerClass: string
  readonly listClass: string
  readonly problem?: string
  /** THE HOST'S TIP, around the picker's trigger. `said` is an accessor so the
   *  sentence follows the pick rather than freezing at the one that was chosen
   *  when this component was built. Absent draws the bare trigger, which is
   *  what a host with no tips of its own gets. */
  readonly tip?: (said: () => string, control: JSX.Element) => JSX.Element
}) {
  const name = (file: string) => file.split("/").at(-1) ?? file
  /** What the trigger is ABOUT: the whole path, of which the button draws the
   *  last segment alone. The host's tip says it to a pointer and the `sr-only`
   *  span inside the button says it to everybody else — the drawn name is a
   *  basename, so the directory it is in was only ever in the tooltip. */
  const said = (): string => props.file ?? "No file chosen"
  const trigger = (): JSX.Element => (
    <button type="button" class={`${props.triggerClass} max-w-[16rem] truncate${props.fault ? " text-alarm" : ""}`} data-testid={props.ids.picker} data-plugin={props.plugin} data-file={props.file ?? "off"} ref={props.picker.setTrigger} aria-expanded={props.picker.open()} onClick={props.picker.toggle}>
      {props.file ? name(props.file) : "Off"}
      <Show when={props.file}>{(file) => <span class="sr-only">{file()}</span>}</Show>
    </button>
  )
  return <>
    <span class="min-w-0 truncate text-muted">{props.subject}</span><span aria-hidden="true" class="text-muted">·</span>
    <Show when={props.file}><span class="text-muted">{props.from}</span></Show>
    {props.tip === undefined ? trigger() : props.tip(said, trigger())}
    <Show when={props.fault}><span class="text-alarm" data-testid={props.ids.fault} data-fault={props.fault} data-file={props.file ?? ""}>{props.fault === "gone" ? "This file is gone. Choose another." : "This file can't be watched. Choose another."}</span></Show>
    <Show when={props.file}><button type="button" class="text-muted underline decoration-dotted" data-testid={props.ids.clear} onClick={() => props.setPick(null)}>Clear</button></Show>
    <Show when={props.problem}><span role="alert" class="text-alarm">{props.problem}</span></Show>
    <Show when={props.picker.open()}>
      <div class={props.listClass} data-testid={props.ids.list} ref={props.picker.setList}>
        <input ref={element => queueMicrotask(() => element.focus())} class="w-full bg-transparent px-2 py-1 text-label text-ink" data-testid={props.ids.query} placeholder="Find a file" value={props.picker.showing() ?? ""} onInput={event => props.picker.show(event.currentTarget.value)} />
        <ul class="list-none"><Show when={props.paths.length} fallback={<li class="text-muted">No matching files</li>}><For each={props.paths}>{file => <li><button type="button" class="flex w-full gap-2 rounded-control px-2 py-1 text-left text-label hover:bg-rule" data-testid={props.ids.file} data-file={file} onClick={() => { props.picker.shut(); props.setPick(file) }}><span class="min-w-0 flex-1 truncate">{name(file)}</span><span class="text-muted">{file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ""}</span></button></li>}</For></Show></ul>
      </div>
    </Show>
  </>
}
