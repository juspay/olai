# Preferences

`preferences` is a browser-only UI row. It contributes a tool to `layout.tools`,
which the shell places in the desktop header (the ⚙ gear, named
**Preferences**) or at the foot of the phone's directory drawer. Its entry owns
`preferences.sections`; other plugins contribute their controls there without
importing the panel implementation. It also offers `preferences.open` — the one
door onto the panel, so a link elsewhere lands here without this package's panel
or its state being imported.

## What the panel looks like

A calm settings pane: rows under headings, each row a label and the control
that sets it, on one line. A row carries at most one short quiet line, where
its label does not already say what the control does, and conditional news
(an **Allow notifications** button, a browser that blocks notifications) only
while it applies. Yes-or-no rows are the one shared switch
(`@olai/ui-primitives`' `Switch.tsx`, also the plugins panel's); named
alternatives are a segmented strip. A switch that cannot move right now is
drawn dimmed and announced as disabled rather than hidden.

A **run** of adjacent groups of one scope closes with its **scope line**. A
fixed heading's rows are this browser's, and the line says so: *Saved in this
browser only.* A plugin-named heading's rows are the serve's — a promoted
setting writes `_olai/Settings.olai` — and its line reads *Saved in
`Settings.olai`, for everyone using this directory.* The line belongs to the RUN
and not to its last group, which is what keeps a group whose body drew no row
(hidden by CSS, the ordinary case for a provider with nothing to offer yet) from
taking its run's line down with it. The ordering makes the promise structural
rather than verbal: browser-local groups draw first, shared ones after, so the
browser-only line can never sit above a shared row.

Today's headings and their contributors:

| heading | rows | contributed by |
| --- | --- | --- |
| Appearance | Theme (ten swatches, the one in force named beside the label), Font, Size | `theme` |
| Outlines | Row density, Show finished | `outlines` |
| Notifications | Alerts, Sound | `alerts` |
| | Reminders | `journal` |
| *a plugin's own name* | the config schema leaves that plugin marked as preferences | `plugin-inspector`, for any running plugin |

Sound and Reminders are dimmed while Alerts is off. The Alerts row reads what
the browser has said about notifications: not asked yet (the button that can
raise the prompt), blocked, or unable to show them.

A **promoted** row is drawn by the plugin inspector, not by this package: a
config schema leaf a plugin annotates with `preference` (see
`@olai/plugin-api/configuration`) is drawn under a heading named after that
plugin, and moves out of the plugins panel while the plugin runs. The rows are
the inspector's own control, so the authored marker, the reset, invalid text
handling, refusals and Escape behave identically in both panels. A heading
whose plugin is not running is not drawn — its contribution is withdrawn, live,
with no reload. A reader that is absent or a file that is broken freezes those
controls with the server's refusal.

## The contribution contract

The headings are this package's own static table, `HEADINGS` in `src/index.ts`:
a key and the words a person reads, drawn in the table's order.

```ts
export const HEADINGS = [
  { key: "appearance", label: "Appearance" },
  { key: "outlines", label: "Outlines" },
  { key: "notifications", label: "Notifications" },
] as const
```

A contribution to `preferences.sections` is a `Section`:

```ts
interface Section {
  readonly heading: HeadingName   // a key of HEADINGS, or a plugin heading
  readonly order: number          // lower first, among this heading's rows only
  readonly scope: "browser" | "shared"   // where these choices are kept
  readonly body: () => JSX.Element
}

// ...where a plugin heading carries the plugin's name and a READER for the
// words a person reads — the build's label, which comes off the roster.
interface PluginHeading { readonly plugin: string; readonly label: () => string }
```

So a contributor names where its rows go and never spells a fixed heading's
words: two plugins sharing a heading cannot disagree about it, and a key that is
not in the table is a type error. A plugin that joins an existing heading
(journal's Reminders, `order: 1`, under alerts' Notifications, `order: 0`)
needs nothing from the plugin already there, and the panel knows no row of its
own. A contributor switched off withdraws its entry, and a heading left with no
entries is not drawn, live, in every open panel. A body that draws no row (a
provider with nothing to offer yet) leaves its heading hidden rather than drawn
over nothing. Each heading's group carries its key as `data-group` — the
plugin's name for a plugin heading.

**`scope` is DECLARED, never inferred**: where a value is kept is a fact about
the contribution, so a plugin that one day draws browser-local rows under its
own heading says `browser` and is ordered and labelled with this browser's rows.
Two entries under one heading should agree; the panel draws a group as `shared`
if any of them says so, because the one arrangement the ordering exists to
prevent is a shared row under the browser-only line.

Browser-local groups draw first — the table's own headings in table order, then
plugin headings by label — and shared groups follow, plugin headings by label.
That ordering is what makes the scope lines honest.

## Opening it from elsewhere

This package offers one service, `preferences.open`, declared as
`preferencesPanel` in `src/index.ts`. A consumer holds it as an optional
dependency (the inspector's "Set in Preferences" link does) and calls `open()`;
when this row is off the service is absent and the consumer draws its own
control. The open bit lives in this row's activation, so a rebuilt shell draws
the door again with the same answer, and no live panel state crosses a package
boundary through an import. It mirrors the inspector's own
`configuration.open(name)`.

## Lifetimes

The theme provider contributes Theme, Font and Size controls. Disabling this
UI removes its panels and those contributions while the theme provider keeps
following stored preferences. Re-enabling the UI reads the existing provider.
Disabling theme removes its controls without removing the rest of the panel.

The Outlines rows are contributed by `outlines`, the Alerts and Sound rows by
`alerts` and the Reminders row by `journal`, each from its own browser half.
Their provider state does not belong to this UI, and this package holds no
control of theirs: the panel is a shell, and a row arrives with the plugin that
owns what it sets. The promoted rows arrive the same way, from the plugin
inspector's own component.

Layout values (sidebar and panel widths) are stored the same way and are
deliberately not here: a width is set by dragging, and a second control for
something that already has one is redundancy.
