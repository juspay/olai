# Preferences

`preferences` is a browser-only UI row. It contributes a tool to `layout.tools`,
which the shell places in the desktop header (the ⚙ gear, named
**Preferences**) or at the foot of the phone's directory drawer. Its entry owns
`preferences.sections`; other plugins contribute their controls there without
importing the panel implementation.

## What the panel looks like

A calm settings pane: rows under headings, each row a label and the control
that sets it, on one line. A row carries at most one short quiet line, where
its label does not already say what the control does, and conditional news
(an **Allow notifications** button, a browser that blocks notifications) only
while it applies. Yes-or-no rows are the one shared switch
(`@olai/ui-primitives`' `Switch.tsx`, also the plugins panel's); named
alternatives are a segmented strip. A switch that cannot move right now is
drawn dimmed and announced as disabled rather than hidden. One line at the foot
says, once: *Saved in this browser only.*

Today's headings and their contributors:

| heading | rows | contributed by |
| --- | --- | --- |
| Appearance | Theme (ten swatches, the one in force named beside the label), Font, Size | `theme` |
| Outlines | Row density, Show finished | `outlines` |
| Notifications | Alerts, Sound | `alerts` |
| | Reminders | `journal` |

Sound and Reminders are dimmed while Alerts is off. The Alerts row reads what
the browser has said about notifications: not asked yet (the button that can
raise the prompt), blocked, or unable to show them.

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
  readonly heading: Heading       // a key of HEADINGS
  readonly order: number          // lower first, among this heading's rows only
  readonly body: () => JSX.Element
}
```

So a contributor names where its rows go and never spells a heading's words:
two plugins sharing a heading cannot disagree about it, and a key that is not
in the table is a type error. A plugin that joins an existing heading
(journal's Reminders, `order: 1`, under alerts' Notifications, `order: 0`)
needs nothing from the plugin already there, and the panel knows no row of its
own. A contributor switched off withdraws its entry, and a heading left with no
entries is not drawn, live, in every open panel. A body that draws no row (a
provider with nothing to offer yet) leaves its heading hidden rather than drawn
over nothing. Each heading's group carries its key as `data-group`.

## Lifetimes

The theme provider contributes Theme, Font and Size controls. Disabling this
UI removes its panels and those contributions while the theme provider keeps
following stored preferences. Re-enabling the UI reads the existing provider.
Disabling theme removes its controls without removing the rest of the panel.

The Outlines rows are contributed by `outlines`, the Alerts and Sound rows by
`alerts` and the Reminders row by `journal`, each from its own browser half.
Their provider state does not belong to this UI, and this package holds no
control of theirs: the panel is a shell, and a row arrives with the plugin that
owns what it sets.

Layout values (sidebar and panel widths) are stored the same way and are
deliberately not here: a width is set by dragging, and a second control for
something that already has one is redundancy.
