import { CONFIGURATION_FILE, type EnvironmentReading } from "@olai/plugin-api/configuration"
import { approveDefinition } from "./approval.ts"
import { asking } from "./asking.ts"
import { TESTID } from "olai-plugin-plugin-inspector/testids"
import { pluginPref } from "olai-plugin-plugin-inspector/testids"
import { createEffect, createMemo, createSelector, createSignal, For, onCleanup, Show } from "solid-js"

import {
  type BuiltPlugin,
  NO_ROSTER,
  PLUGIN_BROWSER_FILE,
  PLUGIN_SERVER_FILE,
  type PluginRoster,
  pluginState,
} from "@olai/surface"

import { run } from "@olai/web/client/run.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { TESTID as PRIMITIVE } from "@olai/ui-primitives/testids.ts"

import type { BrowserManagement } from "@olai/surface/management"
import type { InspectorState } from "./state.ts"
import type { PluginsRowFace } from "./slots.ts"
import { Switch } from "./Switch.tsx"
import { Control } from "./contracts/Control.tsx"

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
  pluginFolder,
  pluginGroups,
  pluginPage,
  pluginPageLabel,
  pluginRows,
  pluginSwitch,
  promotedLinkLabel,
  rowCondition,
  rowSettings,
  sentenceOf,
} from "./rows.ts"
import { preferencesPanel } from "./preferences-door.ts"

/** The reveal that calls this must DEFER it: it runs while this panel is being mounted. */
const intoPreferences = (state: InspectorState): void => {
  state.door.setOpen(false)
  preferencesPanel()?.open()
}

export function Panel(props: {
  readonly state: InspectorState
  readonly management: BrowserManagement
  readonly rows: () => ReadonlyMap<string, PluginsRowFace>
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  const roster = props.management.roster()
  const plugins = (): PluginRoster => roster() ?? NO_ROSTER
  const rows = createMemo(() => pluginRows(plugins()))
  const frozen = () => configurationFrozen(plugins(), props.management.changing())
  const rowFaces = createMemo(() => props.rows(), undefined, { equals: (a, b) => a.size === b.size && [...a].every(([key, value]) => b.get(key) === value) })
  const groups = createMemo(() => pluginGroups(
    plugins(),
    (name) => props.management.look(name),
    props.management.reports(),
    (name) => rowFaces().get(name)?.needs() === true,
  ))
  let element: HTMLElement | undefined
  const requested = createSelector(() => props.state.requested())

  const groupOpen = (group: { readonly label: string; readonly collapsed: boolean }): boolean =>
    props.state.opened()[group.label] ?? !group.collapsed
  const toggleGroup = (label: string, open: boolean): void => {
    props.state.setGroupOpen(label, open)
  }

  const [flipping, setFlipping] = createSignal<string | null>(null)
  const [confirming, setConfirming] = createSignal<string | null>(null)

  const [refused, setRefused] = createSignal<string | null>(null)

  const set = (name: string, pick: PluginPick): void => {
    if (flipping() !== null || props.management.changing()) return
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
      () => setFlipping(null),
    )
  }

  const [approving, setApproving] = createSignal<string | null>(null)

  const approve = (name: string, version: string, forever: boolean): void => {
    if (approving() !== null) return
    void approveDefinition({ name, version, forever }, setApproving, setRefused)
  }

  const rosterFile = (): string => plugins().configurationFile ?? CONFIGURATION_FILE
  return (
    <section ref={el => { element = el; props.inside(el) }} class="plugins-panel" tabindex="-1" data-testid={TESTID.pluginsPanel} aria-label="Plugins">
      <header class="plugins-head">
        <strong class="plugins-title">Plugins</strong>
        <Show when={props.state.file()} keyed fallback={<span class="plugins-head-file">{rosterFile().split("/").pop()}</span>}>
          {File => { const Link = File; return <span class="plugins-head-file" onClick={() => props.state.door.setOpen(false)}><Link
            file={rosterFile()} label={rosterFile()} tip={`Open ${rosterFile()}`} testid={TESTID.pluginsFile}>
            {rosterFile().split("/").pop()} ↗
          </Link></span> }}
        </Show>
      </header>
      <div class="plugins-body">
        <Show when={asking()}>
          {(ask) => (
            <button
              type="button"
              class="plugins-new"
              data-testid={TESTID.pluginsNew}
              onClick={() => { props.state.door.setOpen(false); ask().open() }}
            >
              <span aria-hidden="true">+</span> New plugin
            </button>
          )}
        </Show>
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
                <For each={group.rows}>{plugin => <PluginRow plugin={plugin}
                  face={rowFaces().get(plugin.name)} needs={group.needs}
                  requested={requested(plugin.name)} group={group.label}
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

const SERVER = "Server"

function Chevron(props: { readonly hidden?: boolean }) {
  return <svg class="plugins-chevron" style={props.hidden ? { visibility: "hidden" } : undefined} viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
}

function NodeLink(props: { readonly node: { readonly file: string; readonly id: string } | undefined; readonly state: InspectorState }) {
  return <Show when={props.node ? props.state.file() : undefined} keyed>{Link => { return <span class="plugins-link" onClick={() => props.state.door.setOpen(false)}><Link
    file={props.node!.file} at={props.node!.id} label={configurationLinkLabel} testid={TESTID.pluginConfigLink}>{configurationLinkLabel} ↗</Link></span> }}</Show>
}

function Environment(props: { readonly values: ReadonlyArray<EnvironmentReading> }) {
  return <For each={props.values.filter(environmentVisible)}>{one => <>
    <dt><Tip text={one.key}><span>{sentenceOf(one.says || one.key)}</span></Tip></dt>
    <dd class="plugins-env" data-testid={TESTID.pluginConfig} data-config={one.key} data-value={environmentValue(one)} data-set-by="env">
      <span class={one.set ? "" : "plugins-muted"}>{one.kind === "secret" ? (one.set ? "Set" : "Not set") : one.value === undefined ? "Not set" : <code>{one.value}</code>}</span>
      <code class="plugins-env-key">{one.key}</code>
    </dd>
  </>}</For>
}

function PluginRow(props: {
  readonly plugin: BuiltPlugin
  readonly face: PluginsRowFace | undefined
  readonly needs: boolean
  readonly requested: boolean
  readonly group: string
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
  const drawn = createMemo((): RowSettings => rowSettings(plugin(), preferencesPanel()))
  const look = () => props.panel.management.look(plugin().name)
  const strip = () => pluginSwitch(plugin(), props.flipping() === plugin().name || props.panel.management.changing())
  const shown = () => displayName(plugin(), look())
  const condition = createMemo(() => rowCondition(plugin(), props.panel.management.reports(), props.face?.needs() === true))
  const copy = () => { const now = condition(); return now === null ? null : conditionSaid(now) }
  const tone = () => { const now = condition(); return now === null || CONDITION_TONE[now.kind] === undefined ? "" : `plugins-${CONDITION_TONE[now.kind]}` }
  const cost = () => pluginConfirm(plugin(), (one) => props.panel.management.look(one), props.plugins())
  const session = () => plugin().switchPersistence === "session" || props.plugins().configurationAvailable === false
  const environment = createMemo(() => (plugin().environment ?? []).filter(environmentVisible))
  const broken = () => condition()?.kind === "tabFailed"
  const reveals = createMemo(() => copy() !== null || props.face !== undefined || broken() || plugin().source !== undefined ||
    drawn().knobs.length > 0 || drawn().link || environment().length > 0 || session() ||
    (plugin().configurationNode !== undefined && Boolean(props.panel.state.file())))
  const open = () => reveals() && (props.panel.state.expanded()[plugin().name] ?? props.needs)
  let row: HTMLDivElement | undefined
  createEffect(() => {
    if (!props.requested) return
    const name = plugin().name
    let active = true
    onCleanup(() => { active = false })
    const away = drawn().allAway
    if (!away) {
      props.panel.state.setGroupOpen(props.group, true)
      props.panel.state.setExpanded(name, true)
    }
    queueMicrotask(() => {
      if (!active || props.panel.state.requested() !== name) return
      props.panel.state.revealed(name)
      if (away) { intoPreferences(props.panel.state); return }
      row?.scrollIntoView({ block: "nearest" })
      ;(row?.querySelector<HTMLElement>(".plugins-detail :is(input, select, button)") ?? row?.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true })
    })
  })
  const detailId = `plugins-detail-${plugin().name}`
  return (
    <div ref={row} data-testid={PRIMITIVE.prefsRow} data-pref={pluginPref(plugin().name)} class="plugins-row" data-off={!plugin().running ? "true" : undefined}
      data-open={open() ? "true" : undefined} data-plugin-line>
      <div class="plugins-line">
        <Show when={reveals()} fallback={
          <Tip text={plugin().name} disabled={shown() === plugin().name}>
            <span class="plugins-name">
              <Chevron hidden />
              <span class="plugins-name-text">{shown()}</span>
            </span>
            <Show when={shown() !== plugin().name}><span class="sr-only">{plugin().name}</span></Show>
          </Tip>
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
          <Show when={shown() !== plugin().name}>
            <dt>Short name</dt>
            <dd><code>{plugin().name}</code></dd>
          </Show>
          <Show when={pluginFolder(plugin())} fallback={
            <Show when={plugin().configurationNode && props.panel.state.file()}>
              <dt>Saved in</dt>
              <dd><NodeLink node={plugin().configurationNode} state={props.panel.state} /></dd>
            </Show>
          }>
            {(folder) => (<>
              <dt>Saved in</dt>
              <dd>
                <a class="plugins-link" href={pluginPage(plugin())} data-testid={TESTID.pluginsPage}
                  aria-label={`${pluginPageLabel} — ${folder()}`} onClick={() => props.panel.state.door.setOpen(false)}>
                  <code>{folder()}</code> ↗
                </a>
              </dd>
              <Show when={plugin().configurationNode && props.panel.state.file()}>
                <dt>Settings</dt>
                <dd><NodeLink node={plugin().configurationNode} state={props.panel.state} /></dd>
              </Show>
            </>)}
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
  return <For each={props.values.map(one => one.key)}>{key => {
    const value = () => props.values.find(one => one.key === key)!
    return <>
      <dt><Tip text={value().says} disabled={value().says === ""}><span>{labelOf(key)}</span></Tip></dt>
      <dd><Control name={props.name} label={false} value={value()} configure={props.configure} frozen={props.frozen} /></dd>
    </>
  }}</For>
}

function Defined(props: {
  readonly plugin: BuiltPlugin
  readonly approving: () => string | null
  readonly approve: (name: string, version: string, forever: boolean) => void
  readonly read: string | undefined
  readonly onRead: (name: string, version: string) => void
}) {
  const source = () => props.plugin.source
  const pending = () => pluginState(props.plugin) === "pending"
  const frozen = () => props.approving() !== null
  const moved = () => props.read !== undefined && props.read !== source()?.version
  return (
    <Show when={source()}>
      {(said) => {
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
              {said().title} — {said().folder}, version {said().version}
              {said().approved ? "" : " (not approved)"}
            </summary>
            <Show when={said().description}>{(says) => <p class="mt-1 text-muted">{says()}</p>}</Show>
            <pre class="mt-2 max-h-64 overflow-auto wrap-anywhere whitespace-pre-wrap">
              {`// ${said().folder}${PLUGIN_SERVER_FILE}\n${said().server}${
                said().browser === undefined
                  ? ""
                  : `\n\n// ${said().folder}${PLUGIN_BROWSER_FILE}\n${said().browser}`
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
