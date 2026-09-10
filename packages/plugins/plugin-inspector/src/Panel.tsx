import { CONFIGURATION_FILE, configurationUnavailable, configurationBroken, type EnvironmentReading } from "@olai/plugin-api/configuration"
import { approveDefinition } from "./approval.ts"
import { TESTID } from "olai-plugin-plugin-inspector/testids"
import { pluginPref } from "olai-plugin-plugin-inspector/testids"
/**
 * WHAT THIS INSTANCE IS RUNNING — one row per plugin the build has, and the
 * panel is its own now rather than a section at the foot of preferences.
 *
 * ## Why it left the preferences panel
 *
 * Because the two panels answer two different questions, and one of them is not
 * a preference at all. Preferences is HOW THIS BROWSER READS — the theme, the
 * type, how much of a row is drawn, whether finished work shows — and every row
 * on it is this browser's to change, kept in this browser, different in the next
 * one. A plugin's enablement is the INSTANCE's: the answer is the same in every
 * browser pointed at this server, and a flip made here moves all of them.
 *
 * That argument SURVIVED the rows becoming live, and it is worth saying which
 * half of it was doing the work. It was never *these rows cannot be changed*; it
 * was *these rows are not about the reader*. A live switch on this panel changes
 * what the SERVE is running, for everybody looking at it — which is a different
 * kind of thing from a theme, and still wants a door of its own.
 *
 * Each row draws schema-derived controls inline, with descriptions in titles,
 * source dots and file problems. The link beside its name opens its node. An enable switch
 * writes `on` through the ordinary write door, then waits for the revision and
 * root-owned reconcile before releasing the press. The infrastructure rows
 * needed to read and write that file retain a session-only switch.
 *
 * Shared facts are drawn once: the settings file in the header, source and
 * session legends and private memory at the foot. Only failed or waiting rows
 * add a reason beneath their controls; repeating ordinary status made the old
 * panel a vertical wall of text.
 *
 * ## What is on it, and what is NOT
 *
 * A WALK, not a list: what the `plugins` cell carries is a row per plugin the
 * BUILD has, each saying whether this serve runs it, which of six states it is
 * in, and — on a row that stands behind doors — which rows stop with it. So a
 * third plugin reaches this panel with no line here moving, and nothing in
 * `@olai/web` is the place a plugin's name is hardcoded. The fence one package
 * over holds that as an equality; this file is written so there is nothing for
 * it to catch.
 *
 * A ROW HAS A NAME, INLINE KNOBS AND ENABLE SWITCH. Sections collapse, while
 * knobs need no additional gesture. The row's switch expresses off states;
 * a dashed ring records a session-only switch without repeating the legend.
 *
 * THE LABEL IS THE NAME, VERBATIM — not prettified into `Kolu`. It is the
 * settings namespace, the namespace its members are composed under and the docs
 * slug, and a label that title-cased it would be the one spelling of a plugin's
 * name coming apart on the one screen that tells you what to type.
 *
 * A row still has the same parts: its label, control, what the choice means,
 * and where it came from. What this file owns is the walk and its rendering;
 * the pure decisions live in `./rows.ts`.
 *
 * ## THE ONE SIGNAL, and why it is not a constructor
 *
 * `flipping` is the name of the row whose press is still in the air. It is not a
 * fact about the serve — it is about the button under this reader's finger,
 * which must not be pressed twice — which is exactly the line `olai-plugin-git`’s commit state
 * draws for Commit and Push, and the reason those keep a signal each while
 * everything else about git rides on a cell.
 *
 * It stays HERE rather than moving into a constructor beside them because there
 * is still no second reader: one panel presses, one panel draws the answer, and
 * a factory would be an indirection whose only caller is the file that would
 * have held the signal anyway. What DID move out is the part a test can ask —
 * `./rows.ts`'s `pluginSwitch`, which is the whole decision the signal feeds.
 *
 * The pending flag is cleared when the write, revision and reconcile settle.
 * Controls also stay frozen while the browser reconciles the roster: a state frame may land
 * before its socket replacement finishes, and a second press on that old socket
 * would be interrupted. Server-only rows retain this component, so remounting
 * it cannot be relied on to supply that barrier.
 *
 * ## Where the panel goes is not this file's decision
 *
 * The bar is `sticky` with a z-index, which makes it a stacking context and a
 * 3rem-tall box, so the panel is portalled out of it and positioned against the
 * VIEWPORT. Its stylesheet centers the square box independently of the
 * trigger position; the host still owns dismissal and focus registration.
 *
 * Optional Links follow their declared service lifetime. Section and approval
 * state belong to the inspector, so navigation withdrawal drops the links
 * without forgetting what this reader opened.
 */

import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"

import {
  type BuiltPlugin,
  NO_ROSTER,
  PLUGIN_BROWSER_NODE,
  PLUGIN_SERVER_NODE,
  type PluginRoster,
  pluginState,
} from "@olai/surface"

import { run } from "@olai/web/client/run.ts"
import { TESTID as PRIMITIVE } from "@olai/ui-primitives/testids.ts"

import type { BrowserManagement } from "@olai/surface/management"
import type { InspectorState } from "./state.ts"
import { Switch } from "./Switch.tsx"
import { Control } from "./Control.tsx"

import {
  type PluginPick,
  configurationLinkLabel,
  configurationAuthored,
  enableLabel,
  environmentSource,
  groupCount,
  pluginConfig,
  pluginConfirm,
  pluginGroups,
  pluginRows,
  pluginSwitch,
  rowCopy,
} from "./rows.ts"

export function Panel(props: {
  readonly state: InspectorState
  readonly management: BrowserManagement
  /** Register this surface with the click-away, since it is portalled and so is
   *  not a descendant of the control that opened it. */
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  /** THE ROSTER, read once for the whole panel.
   *
   *  A DIRECT `use()` rather than a constructor: the two things this panel holds
   *  beyond the cell are one signal and one message, both belonging to the press
   *  made on this panel, and neither has a second reader anywhere in the app.
   *  Before the first frame the cell is empty (`@olai/surface`'s `NO_ROSTER`),
   *  so the panel draws no rows at all rather than a set of rows claiming
   *  everything is off — which is the same reason that value exists at all. */
  const roster = props.management.roster()
  const plugins = (): PluginRoster => roster() ?? NO_ROSTER
  const rows = createMemo(() => pluginRows(plugins()))
  const frozen = () => configurationFrozen(plugins(), props.management.changing())
  // Many controls read the same roster. Derive its groups once per publication,
  // not once per field getter while the browser is trying to settle a press.
  const groups = createMemo(() => pluginGroups(plugins(), (name) => props.management.look(name), props.management.reports()))
  let element: HTMLElement | undefined
  let active = true
  onCleanup(() => { active = false })
  createEffect(() => {
    const name = props.state.requested()
    if (name === undefined) return
    const group = groups().find(group => group.rows.some(row => row.name === name))
    if (group === undefined) return
    props.state.setGroupOpen(group.label, true)
    queueMicrotask(() => {
      if (!active || props.state.requested() !== name) return
      const row = element?.querySelector<HTMLElement>(`[data-pref="${CSS.escape(pluginPref(name))}"]`)
      row?.scrollIntoView({ block: "nearest" })
      row?.querySelector<HTMLElement>("input, select, button")?.focus({ preventScroll: true })
      props.state.revealed(name)
    })
  })

  /** WHICH GROUPS THIS READER HAS OPENED OR SHUT — on inspector state, not
   *  this component: a switch rebuilds the shell, and a walk that lived here
   *  would fold back up on the remount. Absent is the YAML default. */
  const groupOpen = (group: { readonly label: string; readonly collapsed: boolean }): boolean =>
    props.state.opened()[group.label] ?? !group.collapsed
  const toggleGroup = (label: string, open: boolean): void => {
    props.state.setGroupOpen(label, open)
  }

  /** WHOSE PRESS IS STILL IN THE AIR — the row's name, or `null`.
   *
   *  A NAME rather than a boolean, so the freeze lands on the row that was
   *  pressed and not on the panel: the other rows are still true, still live,
   *  and a person who pressed the wrong one should be able to press the right
   *  one without waiting for a settle they did not ask for. */
  const [flipping, setFlipping] = createSignal<string | null>(null)
  /** WHOSE OFF IS WAITING ON A CONFIRM — carrying or a switchHint. Cleared by
   *  Keep on, by a different press, and by the settle. */
  const [confirming, setConfirming] = createSignal<string | null>(null)

  /** WHAT THE SERVER WOULD NOT TAKE, or `null` — the same arrangement the
   *  preferences panel keeps for Resume (`../settings/Panel.tsx`), and for the
   *  same reason: a call that never reached the loader happened to THIS
   *  request, nothing on the cell can say so, and a control that silently did
   *  nothing is the failure the whole feature is about.
   *
   *  Cleared when the next press starts, so what is on screen is about the
   *  press a reader just made. */
  const [refused, setRefused] = createSignal<string | null>(null)

  /** THE PRESS. `enabled` is where the switch is being PUT, never which way to
   *  move it: two tabs pressing at once should agree about where they were
   *  aiming, and a "flip" verb read against a roster either of them might have
   *  been drawn from could land on the state neither asked for. */
  const set = (name: string, pick: PluginPick): void => {
    if (flipping() !== null || props.management.changing()) return
    // A switch rebuilds the shell. Remember the group this row sits in so
    // the remount does not fold a walk the reader was just using — including
    // a quiet group that started open because it was unhealthy and becomes
    // collapsed once the flip makes it healthy.
    const group = groups().find((one) => one.rows.some((row) => row.name === name))
    if (group !== undefined) props.state.setGroupOpen(group.label, true)
    if (pick === "off") {
      const plugin = rows().find((one) => one.name === name)
      const cost = plugin === undefined ? null : pluginConfirm(plugin, props.management.look(name))
      if (cost !== null && confirming() !== name) {
        setConfirming(name)
        setRefused(null)
        return
      }
    }
    setConfirming(null)
    setFlipping(name)
    setRefused(null)
    run(
      props.management.set(name, pick === "on"),
      (failure) => {
        setFlipping(null)
        setRefused(failure.message)
      },
      // THE ANSWER CARRIES NOTHING, and it does not need to: what a person is
      // owed is the roster, which the serve republishes once the bundle has
      // stopped moving. This only ever un-freezes the strip — by which time
      // the cell it draws from has already moved under it.
      () => setFlipping(null),
    )
  }

  /** WHOSE APPROVAL IS IN THE AIR — {@link flipping} for the other verb, and a
   *  second signal rather than a shared one because the two controls sit on the
   *  same row and a person may press the switch of one plugin while another's
   *  approval is still landing. */
  const [approving, setApproving] = createSignal<string | null>(null)

  /**
   * SAY YES TO A PLUGIN THE VAULT DEFINES.
   *
   * The VERSION goes with the press — the one this panel drew, off the roster it
   * is looking at — so a serve whose reading has moved on refuses rather than
   * approving source nobody has read. That refusal lands in the same place every
   * other one does, which is what makes "it changed while you were reading"
   * something a person is told rather than something that quietly works.
   *
   * NOTHING COMES BACK. What a person is owed is the row moving from `pending`
   * to `running`, and that arrives on the roster once the write has published a
   * revision and the definition has been followed.
   */
  const approve = (name: string, version: string, forever: boolean): void => {
    if (approving() !== null) return
    void approveDefinition({ name, version, forever }, setApproving, setRefused)
  }

  return (
    <section ref={el => { element = el; props.inside(el) }} class="plugins-grid-panel" tabindex="-1" data-testid={TESTID.pluginsPanel} aria-label="plugins">
      <header class="plugins-grid-head">
        <strong>⧉ plugins</strong>
        <Show when={props.state.file()} fallback={<span class="text-xs text-muted">{plugins().configurationFile ?? CONFIGURATION_FILE}</span>}>
          {File => { const Link = File(); return <span class="text-xs text-muted" onClick={() => props.state.door.setOpen(false)}><Link
            file={plugins().configurationFile ?? CONFIGURATION_FILE} label={plugins().configurationFile ?? CONFIGURATION_FILE} title={`Open ${plugins().configurationFile ?? CONFIGURATION_FILE}`} testid={TESTID.pluginsFile}>
            {plugins().configurationFile ?? CONFIGURATION_FILE} ↗
          </Link></span> }}
        </Show>
      </header>
      <div class="plugins-grid-body"><div class="plugins-grid-columns">
        <For each={groups().map(group => group.label)}>{label => {
          const current = () => groups().find(group => group.label === label)!
          const group = { label, get rows() { return current().rows }, get needs() { return current().needs }, get collapsed() { return current().collapsed } }
          return <section class="plugins-grid-group" data-testid={TESTID.pluginGroup} data-section={group.label}
            data-needs={group.needs ? "true" : undefined} data-collapsed={groupOpen(group) ? undefined : "true"}>
            <details open={groupOpen(group)} class="group/section" onToggle={event => {
              if (!event.currentTarget.isConnected) return
              const next = event.currentTarget.open
              if (next !== groupOpen(group)) toggleGroup(group.label, next)
            }}>
              <summary class="plugins-grid-heading">
                <span class={`font-bold uppercase tracking-wide ${group.needs ? "text-alarm" : ""}`}><span class="group-open/section:hidden">▸ </span><span class="hidden group-open/section:inline">▾ </span>{group.label}</span>
                <span class="text-muted" data-group-count>{groupCount(group.rows)}</span>
              </summary>
              <For each={group.rows.map(plugin => plugin.name)}>{name => <PluginRow plugin={group.rows.find(plugin => plugin.name === name)!}
                panel={props} plugins={plugins} flipping={flipping} confirming={confirming} dismissConfirm={() => setConfirming(null)} set={set} approve={approve} approving={approving} />}</For>
            </details>
          </section>
        }}</For>
        <Show when={plugins().instance}>{instance => <section class="plugins-grid-group">
          <details data-testid={TESTID.thisServe} open={props.state.opened()["This serve"] ?? true} onToggle={event => {
            if (event.currentTarget.isConnected) props.state.setGroupOpen("This serve", event.currentTarget.open)
          }}>
            <summary class="plugins-grid-heading"><strong class="uppercase tracking-wide">This serve</strong><span class="text-muted">{instance().host}:{instance().port}</span></summary>
            <div class="plugins-grid-row">
              <span class="plugins-grid-name"><span>log</span><NodeLink node={instance().configurationNode} state={props.state} /></span>
              <div class="plugins-grid-knobs col-span-2"><Controls labels={false} name="olai" values={instance().policy} configure={props.management.configure} frozen={frozen()} /></div>
              <div class="plugins-grid-extra flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                <span>hostname {instance().hostname}{instance().hostnameAuthor === undefined ? "" : ` ·${instance().hostnameAuthor}`}</span>
                <span>host {instance().host} ·{instance().hostAuthor}</span><span>port {instance().port} ·{instance().portAuthor}</span>
                <span>origins {instance().origins.join(", ") || "none"}</span><span>bearer {instance().bearer.set ? "set" : "unset"}</span>
              </div>
            </div>
          </details>
        </section>}</Show>
      </div>
      <Show when={refused()}>{said => <p class="text-xs text-alarm" data-testid={TESTID.pluginsRefused}>{said()}</p>}</Show>
      <Show when={plugins().configurationError}>{error => <p class="text-xs text-alarm" data-testid={TESTID.pluginConfigError}>{error()}</p>}</Show>
      </div>
      <footer class="plugins-grid-foot" data-testid={TESTID.pluginsStarted}>
        <span class="flex flex-wrap items-center gap-3"><span><span class="text-done">●</span> {configurationAuthored}</span><span><span class="mr-1 inline-block h-2.5 w-3.5 rounded-full border border-dashed border-muted" />session-only</span></span>
        <span>memory · $XDG_STATE_HOME/olai</span>
      </footer>
    </section>
  )
}

function NodeLink(props: { readonly node: { readonly file: string; readonly id: string } | undefined; readonly state: InspectorState }) {
  return <Show when={props.node && props.state.file()}>{File => { const Link = File() as NonNullable<ReturnType<InspectorState["file"]>>; return <span onClick={() => props.state.door.setOpen(false)}><Link
    file={props.node!.file} at={props.node!.id} label={configurationLinkLabel} title={configurationLinkLabel} testid={TESTID.pluginConfigLink}>↗</Link></span> }}</Show>
}

function Environment(props: { readonly values: ReadonlyArray<EnvironmentReading> }) {
  return <For each={props.values}>{one => (
    <span class="plugins-grid-env"
      data-testid={TESTID.pluginConfig} data-config={one.key} data-value={one.kind === "secret" ? (one.set ? "set" : "unset") : (one.value ?? "unset")} data-set-by={environmentSource(one) === "wrapper" ? "default" : "env"} title={`${one.says ?? one.key} · ${one.kind === "secret" ? (one.set ? "set" : "unset") : (one.value ?? "unset")}`}>
      {one.key.toLowerCase().split("_").at(-1)} {environmentSource(one)} · {one.kind === "secret" ? (one.set ? "set" : "unset") : (one.value ?? "unset")}
    </span>
  )}</For>
}

function PluginRow(props: {
  readonly plugin: BuiltPlugin
  readonly panel: {
    readonly state: InspectorState
    readonly management: BrowserManagement
  }
  readonly plugins: () => PluginRoster
  readonly flipping: () => string | null
  readonly confirming: () => string | null
  readonly dismissConfirm: () => void
  readonly set: (name: string, pick: PluginPick) => void
  readonly approve: (name: string, version: string, forever: boolean) => void
  readonly approving: () => string | null
}) {
  const plugin = (): BuiltPlugin => props.plugin
  const values = (): ReadonlyArray<PolicyValue> => plugin().configurationValues ?? pluginConfig(plugin()).map(([key, value]) => ({ key, value, setBy: "default", says: "" }))
  const look = () => props.panel.management.look(plugin().name)
  const strip = () => pluginSwitch(plugin(), props.flipping() === plugin().name || props.panel.management.changing())
  const copy = () => rowCopy(plugin(), props.plugins(), look(), props.panel.management.reports())
  const cost = () => pluginConfirm(plugin(), look())
  const state = () => pluginState(plugin())
  return (
    <div data-testid={PRIMITIVE.prefsRow} data-pref={pluginPref(plugin().name)} class="plugins-grid-row" data-off={!plugin().running ? "true" : undefined} data-plugin-line>
      <span class="plugins-grid-name"><span>{plugin().name}</span><NodeLink node={plugin().configurationNode} state={props.panel.state} /></span>
      <div class="plugins-grid-knobs">
        <Controls name={plugin().name} values={values()} configure={props.panel.management.configure} frozen={configurationFrozen(props.plugins(), props.panel.management.changing())} />
        <Environment values={plugin().environment ?? []} />
      </div>
      <Switch label={enableLabel(plugin().name)} on={strip().value === "on"} frozen={strip().frozen}
        session={plugin().switchPersistence === "session" || props.plugins().configurationAvailable === false} onPick={value => props.set(plugin().name, value)} />
      <div class="plugins-grid-extra">
      <Show when={copy()}>
        {(said) => (
          <p
            class={`pb-1 text-xs leading-relaxed ${
              state() === "failed" ? "text-alarm" : state() === "waiting" ? "text-doing" : "text-muted"
            }`}
            data-testid={PRIMITIVE.prefsHint}
          >
            {said()}
          </p>
        )}
      </Show>
      <Show when={props.confirming() === plugin().name && cost()}>
        {(said) => (
          <div
            class="mb-1.5 rounded-md border border-alarm/25 bg-alarm/5 px-2.5 py-2"
            data-testid={TESTID.pluginConfirm}
          >
            <p class="mb-2 text-xs leading-relaxed text-ink">{said()}</p>
            <div class="flex gap-1.5">
              <button
                type="button"
                class="rounded border border-rule px-2 py-0.5 text-xs"
                data-testid={TESTID.pluginConfirmKeep}
                onClick={() => props.dismissConfirm()}
              >
                Keep on
              </button>
              <button
                type="button"
                class="rounded border border-alarm/45 px-2 py-0.5 text-xs text-alarm"
                data-testid={TESTID.pluginConfirmOff}
                onClick={() => props.set(plugin().name, "off")}
              >
                Turn off
              </button>
            </div>
          </div>
        )}
      </Show>
      <Show when={plugin().source !== undefined}>
        <Defined
          plugin={plugin()}
          approving={props.approving}
          approve={props.approve}
          read={props.panel.state.read().get(plugin().name)}
          onRead={props.panel.state.nowRead}
        />
      </Show>
      <Show when={plugin().running && [...props.panel.management.reports()].some(([name, report]) =>
        (name === plugin().name || name.startsWith(plugin().name + "/")) && report.state === "failed") }>
        <Show when={props.panel.management.requiresReload(plugin().name)} fallback={
          <button type="button" disabled={props.panel.management.changing()} onClick={() => { void props.panel.management.retry() }}>
            Retry browser activation
          </button>
        }>
          <p>Reload to recover this browser module. Save any unfinished edits first.</p>
          <button type="button" onClick={() => props.panel.management.reload()}>Reload page</button>
        </Show>
      </Show>
      </div>
    </div>
  )
}

const configurationFrozen = (roster: PluginRoster, changing: boolean): string | undefined =>
  roster.configurationAvailable !== true ? configurationUnavailable
    : roster.configurationError !== undefined ? configurationBroken(roster.configurationFile)
    : changing ? "Applying the change…" : undefined

function Controls(props: {
  readonly name: string
  readonly values: ReadonlyArray<PolicyValue>
  readonly configure: BrowserManagement["configure"]
  readonly labels?: boolean
  readonly frozen?: string
}) {
  // Keys preserve drafts across unrelated publications; the reading stays live.
  return <For each={props.values.map(one => one.key)}>{key => <Control name={props.name}
    label={props.labels} value={props.values.find(one => one.key === key)!} configure={props.configure} frozen={props.frozen} />}</For>
}

/**
 * ONE PLUGIN THE VAULT DEFINES — its source, and the verb that says yes to it.
 *
 * ## Why the source is drawn at all, and why it is drawn WHOLE
 *
 * This is the one place in this product where a person is deciding about CODE
 * rather than about a setting, and the code will run with the server's own
 * authority — there is no sandbox and this phase does not pretend to build one.
 * So the decision has to be made in front of the thing being decided about. A
 * panel that asked somebody to approve a content hash would be asking them to
 * approve something they cannot see, which is a consent dialog and not a
 * decision.
 *
 * It is a `<details>` rather than always-open because a serve with three
 * approved definitions would otherwise draw three files' worth of code every
 * time somebody opened this panel to flip a row — and it is OPEN by default on a
 * row that is `pending`, which is exactly the row whose whole point is being
 * read.
 *
 * ## The two verbs, and why the second one exists
 *
 * *`approved: <content hash>` for one version, `approved: always` for every
 * later one* (the human, 2026-09-05). One version is the careful answer and the
 * default reading of the button on the left; `always` is for a plugin somebody
 * is iterating on with an agent, where re-approving every edit is a gesture that
 * stops being read after the third time — which is the failure mode a
 * per-version prompt has, rather than a safety property it keeps.
 *
 * Both write a property on the plugin's own node through the ordinary write
 * door, so the decision travels with the vault and is in the ledger like the
 * source it is about.
 */
function Defined(props: {
  readonly plugin: BuiltPlugin
  readonly approving: () => string | null
  readonly approve: (name: string, version: string, forever: boolean) => void
  /** WHICH VERSION OF THIS DEFINITION THE READER HAS BEEN SHOWN — see the
   *  activation-owned reading history, which survives shell remounts. */
  readonly read: string | undefined
  readonly onRead: (name: string, version: string) => void
}) {
  const source = () => props.plugin.source
  const pending = () => pluginState(props.plugin) === "pending"
  const frozen = () => props.approving() !== null
  /**
   * HAS WHAT IS ON SCREEN MOVED SINCE THE READER STARTED READING IT.
   *
   * The row is drawn off the roster and the roster is live, so an edit that
   * lands while somebody has this block open REPLACES the source under them —
   * and the verbs beside it went on being armed, sending whatever version was
   * current at the moment of the press. The version on the wire was therefore
   * always the one the serve already had, which made the serve's own guard
   * (*this has been edited since this page drew it*) unreachable from the one
   * client that exists, and made the gesture *approve whatever is there now*
   * rather than *approve what I read*.
   *
   * So the block remembers the version it first showed this reader, and an
   * arrival disarms rather than swapping quietly. What re-arms it is reading
   * again, which is a press of its own.
   */
  const moved = () => props.read !== undefined && props.read !== source()?.version
  return (
    <Show when={source()}>
      {(said) => {
        // WHAT THIS READER HAS SEEN, recorded the first time this definition is
        // drawn for them and never afterwards — recording it again on every
        // frame is exactly the swap this exists to refuse.
        if (props.read === undefined) props.onRead(props.plugin.name, said().version)
        return (
          <details
            open={pending()}
            class="rounded border border-line/60 p-2 text-xs"
            data-testid={TESTID.pluginsSource}
            data-plugin={props.plugin.name}
            data-version={said().version}
          >
            <summary class="cursor-pointer text-muted">
              {props.plugin.name} — {said().file}, version {said().version}
              {said().approved ? "" : " (not approved)"}
            </summary>
            <pre class="mt-2 max-h-64 overflow-auto wrap-anywhere whitespace-pre-wrap">
              {`// ${PLUGIN_SERVER_NODE}\n${said().server}${
                said().browser === undefined
                  ? ""
                  : `\n\n// ${PLUGIN_BROWSER_NODE}\n${said().browser}`
              }`}
            </pre>
            <Show when={pending()}>
              <Show
                when={!moved()}
                fallback={
                  <div class="mt-2 flex items-center gap-2" data-testid={TESTID.pluginsMoved}>
                    <p class="text-alarm">
                      This changed while you were reading it. Above is what it says now.
                    </p>
                    <button
                      type="button"
                      class="rounded border border-line px-2 py-1"
                      onClick={() => props.onRead(props.plugin.name, said().version)}
                    >
                      I have read it
                    </button>
                  </div>
                }
              >
                <div class="mt-2 flex gap-2">
                  <button
                    type="button"
                    class="rounded border border-line px-2 py-1"
                    disabled={frozen()}
                    data-testid={TESTID.pluginsApprove}
                    onClick={() => props.approve(props.plugin.name, said().version, false)}
                  >
                    Approve this version
                  </button>
                  <button
                    type="button"
                    class="rounded border border-line px-2 py-1"
                    disabled={frozen()}
                    data-testid={TESTID.pluginsApproveAlways}
                    onClick={() => props.approve(props.plugin.name, said().version, true)}
                  >
                    Approve always
                  </button>
                </div>
              </Show>
            </Show>
          </details>
        )
      }}
    </Show>
  )
}

type PolicyValue = NonNullable<BuiltPlugin["configurationValues"]>[number]
