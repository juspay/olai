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
 * A ROW AT REST IS ONE LINE: the name a person reads, a few words of state
 * only when it is stuck, and the switch. Everything else — the schema-derived
 * knobs, environment readouts, the link to its node, the plugin's own face,
 * the full sentence about what is wrong and a session-only note — is the row's
 * DETAIL, a label/value list behind its disclosure. A row filed under Needs
 * attention starts expanded, because its detail is what to do. An enable switch
 * writes `on` through the ordinary write door, then waits for the revision and
 * root-owned reconcile before releasing the press. The infrastructure rows
 * needed to read and write that file retain a session-only switch, and say so
 * in their detail rather than in a legend at the foot.
 *
 * The Server section closes the list, shut by default: the address, log
 * policy, allowed origins, whether an access token is set and the state folder,
 * each under a plain label with the raw value in monospace.
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
 * Groups start shut, showing their counts; the row's switch expresses off
 * states, and a dashed ring still marks a session-only switch.
 *
 * AND A ROW WHOSE PLUGIN HAS MORE TO SAY DRAWS ITS OWN FACE — in the row's
 * detail, below the row's sentence, because that is the order a person reads
 * in (`./slots.ts`'s `plugins.row`). The same face answers `needs()`, which the
 * walk here passes straight into `./rows.ts`, so a plugin that is running,
 * faultless and still waiting on somebody is filed under Needs attention with
 * the broken rows rather than sitting among the healthy ones.
 *
 * THE LABEL IS THE BUILD'S — `olai.yml`'s `label`, read through the host's
 * look like `section` — and the plugin's own name, the settings namespace
 * a person types, stays on the row as its detail's short name.
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
import { CONFIGURATION_FILE, type EnvironmentReading } from "@olai/plugin-api/configuration"
import { approveDefinition } from "./approval.ts"
import { TESTID } from "olai-plugin-plugin-inspector/testids"
import { pluginPref } from "olai-plugin-plugin-inspector/testids"
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
import type { PluginsRowFace } from "./slots.ts"
import { Switch } from "./Switch.tsx"
import { Control } from "./Control.tsx"

import type { RowSettings } from "./rows.ts"
import {
  type PluginPick,
  CONDITION_TONE,
  CONDITION_WORDS,
  conditionSaid,
  configurationFrozen,
  configurationLinkLabel,
  displayName,
  enableLabel,
  environmentValue,
  environmentVisible,
  groupCount,
  labelOf,
  pluginConfirm,
  pluginGroups,
  pluginRows,
  pluginSwitch,
  promotedLinkLabel,
  rowCondition,
  rowSettings,
  sentenceOf,
} from "./rows.ts"
import { preferencesPanel } from "./preferences-door.ts"

/** THE ONE GESTURE THAT REACHES A PROMOTED SETTING: shut this panel and open the
 *  one that has the control. Written once because the row's link and the reveal
 *  above are the same gesture — and it is the reveal that must DEFER it (see
 *  its own note: it runs while this panel is being mounted). */
const intoPreferences = (state: InspectorState): void => {
  state.door.setOpen(false)
  preferencesPanel()?.open()
}

export function Panel(props: {
  readonly state: InspectorState
  readonly management: BrowserManagement
  /** WHAT EACH ROW'S OWN PLUGIN HUNG ON IT — what `plugins.row` holds right
   *  now, keyed by the contributing plugin. A READER rather than the table: the
   *  hold belongs to the component that draws the panel (`./browser.tsx`'s
   *  `tools`), and this file only asks, so a face arriving while the panel is
   *  open is drawn and a face that leaves takes its own drawing with it. */
  readonly rows: () => ReadonlyMap<string, PluginsRowFace>
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
  /** WHAT EVERY ROW'S OWN PLUGIN HUNG — one map per publication of the table,
   *  so the grouping below, the row lookups and the drawings all read the same
   *  answer rather than rebuilding it per field getter. */
  const rowFaces = createMemo(() => props.rows())
  // Many controls read the same roster. Derive its groups once per publication,
  // not once per field getter while the browser is trying to settle a press.
  // The fourth argument is the one reading of a FACE the walk makes, asked
  // before anything is drawn (`./rows.ts`'s `needsYou`): a face's own `needs`
  // is live state its plugin holds, so it is called here, inside the memo,
  // where a change to it is tracked.
  const groups = createMemo(() => pluginGroups(
    plugins(),
    (name) => props.management.look(name),
    props.management.reports(),
    (name) => rowFaces().get(name)?.needs() === true,
  ))
  let element: HTMLElement | undefined
  let active = true
  onCleanup(() => { active = false })
  createEffect(() => {
    const name = props.state.requested()
    if (name === undefined) return
    const plugin = rows().find((row) => row.name === name)
    const group = groups().find(group => group.rows.some(row => row.name === name))
    if (group === undefined) return
    // A ROW WHOSE EVERY LEAF IS PROMOTED has nothing to open HERE — the one
    // control it would reveal is a link to the other panel, and somebody asking
    // for the row's settings wants the setting, not a door to it. So the
    // request lands where the settings are, and this panel shuts behind them.
    if (plugin !== undefined && rowSettings(plugin, preferencesPanel()).allAway) {
      props.state.revealed(name)
      // DEFERRED, like the focus below: this effect runs while the panel it
      // belongs to is being mounted (opening the door is what drew it), and
      // shutting that door from inside its own render leaves the portal behind.
      queueMicrotask(() => { if (active) intoPreferences(props.state) })
      return
    }
    props.state.setGroupOpen(group.label, true)
    props.state.setExpanded(name, true)
    queueMicrotask(() => {
      if (!active || props.state.requested() !== name) return
      const row = element?.querySelector<HTMLElement>(`[data-pref="${CSS.escape(pluginPref(name))}"]`)
      row?.scrollIntoView({ block: "nearest" })
      // The first knob in its detail where it has one, else the row's own
      // disclosure or switch.
      ;(row?.querySelector<HTMLElement>(".plugins-detail :is(input, select, button)") ?? row?.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true })
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
      const cost = plugin === undefined ? null : pluginConfirm(plugin, (one) => props.management.look(one), plugins())
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

  const rosterFile = (): string => plugins().configurationFile ?? CONFIGURATION_FILE
  return (
    <section ref={el => { element = el; props.inside(el) }} class="plugins-panel" tabindex="-1" data-testid={TESTID.pluginsPanel} aria-label="Plugins">
      <header class="plugins-head">
        <strong class="plugins-title">Plugins</strong>
        <Show when={props.state.file()} fallback={<span class="plugins-head-file">{rosterFile().split("/").pop()}</span>}>
          {File => { const Link = File(); return <span class="plugins-head-file" onClick={() => props.state.door.setOpen(false)}><Link
            file={rosterFile()} label={rosterFile()} title={`Open ${rosterFile()}`} testid={TESTID.pluginsFile}>
            {rosterFile().split("/").pop()} ↗
          </Link></span> }}
        </Show>
      </header>
      <div class="plugins-body">
        <Show when={plugins().configurationAvailable === false && plugins().built.length > 0}>
          <p class="plugins-notice">{rosterFile().split("/").pop()} can't be read, so switches here reset when olai restarts.</p>
        </Show>
        <Show when={refused()}>{said => <p class="plugins-notice plugins-alarm" data-testid={TESTID.pluginsRefused}>{said()}</p>}</Show>
        <Show when={plugins().configurationError}>{error => <p class="plugins-notice plugins-alarm" data-testid={TESTID.pluginConfigError}>{error()}</p>}</Show>
        <For each={groups().map(group => group.label)}>{label => {
          const current = () => groups().find(group => group.label === label)!
          const group = { label, get rows() { return current().rows }, get needs() { return current().needs }, get collapsed() { return current().collapsed } }
          return <section class="plugins-group" data-testid={TESTID.pluginGroup} data-section={group.label}
            data-needs={group.needs ? "true" : undefined} data-collapsed={groupOpen(group) ? undefined : "true"}>
            <details open={groupOpen(group)} onToggle={event => {
              if (!event.currentTarget.isConnected) return
              const next = event.currentTarget.open
              if (next !== groupOpen(group)) toggleGroup(group.label, next)
            }}>
              <summary class="plugins-heading">
                <Chevron />
                <span class="plugins-heading-label">{group.label}</span>
                <span class="plugins-heading-count" data-group-count>{group.needs ? group.rows.length : groupCount(group.rows)}</span>
              </summary>
              <div class="plugins-rows">
                <For each={group.rows.map(plugin => plugin.name)}>{name => <PluginRow plugin={group.rows.find(plugin => plugin.name === name)!}
                  face={rowFaces().get(name)} needs={group.needs}
                  panel={props} plugins={plugins} flipping={flipping} confirming={confirming} dismissConfirm={() => setConfirming(null)} set={set} approve={approve} approving={approving} />}</For>
              </div>
            </details>
          </section>
        }}</For>
        <Show when={plugins().instance}>{instance => <section class="plugins-group">
          <details data-testid={TESTID.thisServe} open={props.state.opened()[SERVER] ?? false} onToggle={event => {
            if (event.currentTarget.isConnected) props.state.setGroupOpen(SERVER, event.currentTarget.open)
          }}>
            <summary class="plugins-heading">
              <Chevron />
              <span class="plugins-heading-label">{SERVER}</span>
              <span class="plugins-heading-count">{instance().hostname}</span>
            </summary>
            <dl class="plugins-detail plugins-server">
              <dt>Address</dt>
              <dd><code>{instance().host}:{instance().port}</code></dd>
              <dt>Machine name</dt>
              <dd><code>{instance().hostname}</code></dd>
              <Controls name="olai" values={instance().policy} configure={props.management.configure} frozen={frozen()} />
              <dt>Allowed origins</dt>
              <dd><Show when={instance().origins.length > 0} fallback={<span class="plugins-muted">None</span>}>
                <span class="plugins-list"><For each={instance().origins}>{origin => <code>{origin}</code>}</For></span>
              </Show></dd>
              <dt>Access token</dt>
              <dd>{instance().bearer.set ? "Set" : "Not set"}</dd>
              <dt>State folder</dt>
              <dd data-testid={TESTID.pluginsStarted}><code>$XDG_STATE_HOME/olai</code></dd>
              <Show when={instance().configurationNode && props.state.file()}>
                <dt>Saved in</dt>
                <dd><NodeLink node={instance().configurationNode} state={props.state} /></dd>
              </Show>
            </dl>
          </details>
        </section>}</Show>
      </div>
    </section>
  )
}

/** The Server section's heading, and its key on inspector state's open map. */
const SERVER = "Server"

/** `hidden` keeps the chevron's width so a row with nothing to open lines its
 *  name up with the rows that have one. */
function Chevron(props: { readonly hidden?: boolean }) {
  return <svg class="plugins-chevron" style={props.hidden ? { visibility: "hidden" } : undefined} viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
}

function NodeLink(props: { readonly node: { readonly file: string; readonly id: string } | undefined; readonly state: InspectorState }) {
  return <Show when={props.node && props.state.file()}>{File => { const Link = File() as NonNullable<ReturnType<InspectorState["file"]>>; return <span class="plugins-link" onClick={() => props.state.door.setOpen(false)}><Link
    file={props.node!.file} at={props.node!.id} label={configurationLinkLabel} title={configurationLinkLabel} testid={TESTID.pluginConfigLink}>{configurationLinkLabel} ↗</Link></span> }}</Show>
}

function Environment(props: { readonly values: ReadonlyArray<EnvironmentReading> }) {
  return <For each={props.values.filter(environmentVisible)}>{one => <>
    <dt title={one.key}>{sentenceOf(one.says || one.key)}</dt>
    <dd class="plugins-env" data-testid={TESTID.pluginConfig} data-config={one.key} data-value={environmentValue(one)} data-set-by="env">
      <span class={one.set ? "" : "plugins-muted"}>{one.kind === "secret" ? (one.set ? "Set" : "Not set") : one.value === undefined ? "Not set" : <code>{one.value}</code>}</span>
      <code class="plugins-env-key">{one.key}</code>
    </dd>
  </>}</For>
}

function PluginRow(props: {
  readonly plugin: BuiltPlugin
  /** WHAT THIS ROW'S OWN PLUGIN HUNG — `undefined` where it hung nothing, and
   *  then the row draws exactly what it drew before this slot existed. */
  readonly face: PluginsRowFace | undefined
  /** Filed under Needs attention: its detail starts expanded. */
  readonly needs: boolean
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
  /** WHAT THIS ROW DRAWS, read live: the promoted leaves are away only while
   *  their plugin runs AND the panel that takes them is up, so switching that
   *  panel off (`../preferences`) brings the controls back without a reload.
   *  The reading is one object (`rows.ts`) because the row, the link and the
   *  panel's own `open` must agree about it. */
  /** WHAT THIS ROW DRAWS — named for the drawing rather than for the settings
   *  row it is about, which is a plugin's name and may not be spelled here
   *  (`@olai/bundle`'s fence is right about that). */
  const drawn = (): RowSettings => rowSettings(plugin(), preferencesPanel())
  const look = () => props.panel.management.look(plugin().name)
  const strip = () => pluginSwitch(plugin(), props.flipping() === plugin().name || props.panel.management.changing())
  const shown = () => displayName(plugin(), look())
  const condition = () => rowCondition(plugin(), props.panel.management.reports(), props.face?.needs() === true)
  const copy = () => { const now = condition(); return now === null ? null : conditionSaid(now) }
  const tone = () => { const now = condition(); return now === null || CONDITION_TONE[now.kind] === undefined ? "" : `plugins-${CONDITION_TONE[now.kind]}` }
  const cost = () => pluginConfirm(plugin(), (one) => props.panel.management.look(one), props.plugins())
  const session = () => plugin().switchPersistence === "session" || props.plugins().configurationAvailable === false
  const environment = () => (plugin().environment ?? []).filter(environmentVisible)
  const broken = () => condition()?.kind === "tabFailed"
  /** Whether the row has anything to show beyond its short name. A row that
   *  does not draws no chevron and does not open: a press that reveals only
   *  the name already on it is a door to nothing. */
  const reveals = () => copy() !== null || props.face !== undefined || broken() || plugin().source !== undefined ||
    drawn().knobs.length > 0 || drawn().link || environment().length > 0 || session() ||
    (plugin().configurationNode !== undefined && Boolean(props.panel.state.file()))
  const open = () => reveals() && (props.panel.state.expanded()[plugin().name] ?? props.needs)
  const detailId = `plugins-detail-${plugin().name}`
  return (
    <div data-testid={PRIMITIVE.prefsRow} data-pref={pluginPref(plugin().name)} class="plugins-row" data-off={!plugin().running ? "true" : undefined}
      data-open={open() ? "true" : undefined} data-plugin-line>
      <div class="plugins-line">
        <Show when={reveals()} fallback={
          <span class="plugins-name" title={shown() !== plugin().name ? plugin().name : undefined}>
            <Chevron hidden />
            <span class="plugins-name-text">{shown()}</span>
          </span>
        }>
          <button type="button" class="plugins-name" aria-expanded={open()} aria-controls={detailId}
            onClick={() => props.panel.state.setExpanded(plugin().name, !open())}>
            <Chevron />
            <span class="plugins-name-text">{shown()}</span>
          </button>
        </Show>
        <Show when={condition()}>{now => <span class={`plugins-status ${tone()}`}>{CONDITION_WORDS[now().kind]}</span>}</Show>
        <Switch label={enableLabel(shown())} on={strip().value === "on"} frozen={strip().frozen}
          session={session()} onPick={value => props.set(plugin().name, value)} />
      </div>
      <Show when={props.confirming() === plugin().name && cost()}>
        {(said) => (
          <div class="plugins-confirm" data-testid={TESTID.pluginConfirm}>
            <p>{said()}</p>
            <div class="plugins-confirm-verbs">
              <button type="button" data-testid={TESTID.pluginConfirmKeep} onClick={() => props.dismissConfirm()}>Keep on</button>
              <button type="button" class="plugins-alarm" data-testid={TESTID.pluginConfirmOff} onClick={() => props.set(plugin().name, "off")}>Turn off</button>
            </div>
          </div>
        )}
      </Show>
      <div class="plugins-detail-wrap" id={detailId} hidden={!open()}>
        <Show when={copy()}>
          {(said) => (
            <p class={`plugins-said ${tone()}`} data-testid={PRIMITIVE.prefsHint}>
              {said()}
            </p>
          )}
        </Show>
        {/* WHAT THE ROW'S OWN PLUGIN SAYS AND OFFERS — below the row's own
            sentence, above its knobs, because that is the order a person
            reads in: what the serve is doing, then what they have to do about
            it. The FACE owns both halves of its drawing, sentence and verbs
            alike; nothing is drawn where the plugin hung no face. */}
        <Show when={props.face}>{(face) => <div class="plugins-face">{face().body()}</div>}</Show>
        <Show when={broken()}>
          <div class="plugins-actions">
            <Show when={props.panel.management.requiresReload(plugin().name)} fallback={
              <button type="button" disabled={props.panel.management.changing()} onClick={() => { void props.panel.management.retry() }}>
                Try again
              </button>
            }>
              <p>Reload the page to fix this. Save any unfinished edits first.</p>
              <button type="button" onClick={() => props.panel.management.reload()}>Reload</button>
            </Show>
          </div>
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
        <dl class="plugins-detail">
          <Controls name={plugin().name} values={drawn().knobs} configure={props.panel.management.configure} frozen={configurationFrozen(props.plugins(), props.panel.management.changing())} />
          {/* A PROMOTED LEAF IS NOT DRAWN HERE while its plugin runs and the
              preferences panel is up: one link, in their place, that shuts this
              panel and opens that one. The plugin's own leaves stay editable in
              the preferences panel; while it is off, or Preferences is, the
              controls above are unchanged. */}
          <Show when={drawn().link}>
            <dt>Preferences</dt>
            <dd>
              <button type="button" class="plugins-link" data-testid={TESTID.pluginPreferenceLink}
                onClick={() => intoPreferences(props.panel.state)}>
                {promotedLinkLabel}
              </button>
            </dd>
          </Show>
          <Show when={environment().length > 0}><Environment values={environment()} /></Show>
          {/* The name a person types in the settings file, where the row's
              label is not already it — and the link to its node there. */}
          <Show when={shown() !== plugin().name}>
            <dt>Short name</dt>
            <dd><code>{plugin().name}</code></dd>
          </Show>
          <Show when={plugin().configurationNode && props.panel.state.file()}>
            <dt>Saved in</dt>
            <dd><NodeLink node={plugin().configurationNode} state={props.panel.state} /></dd>
          </Show>
        </dl>
        <Show when={session()}>
          <p class="plugins-note">This switch resets when olai restarts.</p>
        </Show>
      </div>
    </div>
  )
}

function Controls(props: {
  readonly name: string
  readonly values: ReadonlyArray<PolicyValue>
  readonly configure: BrowserManagement["configure"]
  readonly frozen?: string
}) {
  // Keys preserve drafts across unrelated publications; the reading stays live.
  // One label/value pair per knob: the label is the key in words, and the
  // schema's own description is its tooltip.
  return <For each={props.values.map(one => one.key)}>{key => {
    const value = () => props.values.find(one => one.key === key)!
    return <>
      <dt title={value().says || undefined}>{labelOf(key)}</dt>
      <dd><Control name={props.name} label={false} value={value()} configure={props.configure} frozen={props.frozen} /></dd>
    </>
  }}</For>
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
            class="rounded-control border border-line/60 p-2 text-label"
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
                      class="rounded-control border border-line px-2 py-1"
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
                    class="rounded-control border border-line px-2 py-1"
                    disabled={frozen()}
                    data-testid={TESTID.pluginsApprove}
                    onClick={() => props.approve(props.plugin.name, said().version, false)}
                  >
                    Approve this version
                  </button>
                  <button
                    type="button"
                    class="rounded-control border border-line px-2 py-1"
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
