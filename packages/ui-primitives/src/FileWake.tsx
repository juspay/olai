/** A pure file picker: its owner supplies paths, labels, status and the write. */
import { For, Show } from "solid-js"
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
}) {
  const name = (file: string) => file.split("/").at(-1) ?? file
  return <>
    <span class="min-w-0 truncate text-muted">{props.subject}</span><span aria-hidden="true" class="text-muted">·</span>
    <Show when={props.file}><span class="text-muted">{props.from}</span></Show>
    <button type="button" class={`${props.triggerClass} max-w-[16rem] truncate${props.fault ? " text-alarm" : ""}`} data-testid={props.ids.picker} data-plugin={props.plugin} data-file={props.file ?? "off"} title={props.file ?? undefined} ref={props.picker.setTrigger} aria-expanded={props.picker.open()} onClick={props.picker.toggle}>{props.file ? name(props.file) : "off"}</button>
    <Show when={props.fault}><span class="text-alarm" data-testid={props.ids.fault} data-fault={props.fault} data-file={props.file ?? ""}>{props.fault === "gone" ? "gone — pick another file" : "not one this can watch — pick another file"}</span></Show>
    <Show when={props.file}><button type="button" class="text-muted underline decoration-dotted" data-testid={props.ids.clear} onClick={() => props.setPick(null)}>clear</button></Show>
    <Show when={props.problem}><span role="alert" class="text-alarm">{props.problem}</span></Show>
    <Show when={props.picker.open()}>
      <div class={props.listClass} data-testid={props.ids.list} ref={props.picker.setList}>
        <input ref={element => queueMicrotask(() => element.focus())} class="w-full bg-transparent px-2 py-1 text-xs text-ink" data-testid={props.ids.query} placeholder="file" value={props.picker.showing() ?? ""} onInput={event => props.picker.show(event.currentTarget.value)} />
        <ul class="list-none"><Show when={props.paths.length} fallback={<li class="text-muted">no such file here</li>}><For each={props.paths}>{file => <li><button type="button" class="flex w-full gap-2 rounded px-2 py-1 text-left text-xs hover:bg-rule" data-testid={props.ids.file} data-file={file} onClick={() => { props.picker.shut(); props.setPick(file) }}><span class="min-w-0 flex-1 truncate">{name(file)}</span><span class="text-muted">{file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ""}</span></button></li>}</For></Show></ul>
      </div>
    </Show>
  </>
}
