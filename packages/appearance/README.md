# Appearance

Pure palette, type-size and text-scale tables, CSS generation, contrast arithmetic
and icon drawing shared by Olai's presentation plugins. Importing this package
creates no state, listeners or DOM resources. Theme owns preference state and
uses these values in its runtime and static build contribution. Fonts have their
own catalog and build conversion in `@olai/fonts`.

## The interface scale — the rule for chrome

Everything that is interface chrome rather than a reader's own content — the
header, the sidebar, menus, popovers, panels, dialogs, rows of controls — is
drawn from one small scale, declared in `src/tokens.css`'s `@theme` and named
for the job each step does, so a call site says what a thing IS and never how
big it happens to be. A new surface picks from this scale; it does not spell a
pixel size, a corner or a shadow of its own. `src/tokens.test.ts` holds the
names, so growing the scale is a deliberate edit of that test and of this page.

**Five type sizes.** All `rem`, so the Size preference (`src/sizes.ts`) moves
every one of them with the root; nothing in chrome is set smaller than a
caption.

| utility | job |
| --- | --- |
| `text-caption` | counts, small-caps section headings, the smallest labels |
| `text-label` | secondary text beside a control: hints, notes, a status word, a panel's headings |
| `text-body` | the default for controls, menu items and sidebar rows |
| `text-title` | a panel's or dialog's own name |
| `text-display` | a page's own name: Agenda, a day, the Trash |

**Three corners.** `rounded-control` for anything a pointer presses and for
the rows a list is made of; `rounded-surface` for anything that floats or
holds controls (menus, popovers, panels, cards, dialogs); Tailwind's own
`rounded-full` for pills, dots, round buttons, swatches and switches.

**Two shadows.** `shadow-raised` for what hangs off a control (a menu, a
popover, a tooltip, a switch's knob); `shadow-overlay` for what covers the
page (the palette, a dialog, a phone sheet). Black at low alpha rather than a
palette ink: ink inverts in the dark palettes, and a shadow that glowed would
not be one.

**Five opacity steps.** A colour at partial strength — a rule, a wash, a
muted border, a dimmed control — is one of `/10`, `/20`, `/40`, `/60` or
`/80` (`border-paper/20`, `divide-rule/40`, `opacity-60` on a frozen switch).
Two neighbouring steps are a visible difference; `/15` beside `/20` is not,
and is how a surface drifts into a dozen almost-equal greys.

The markdown content scale (`src/scale.ts`) is a separate, deliberate system
for what a reader wrote. It does not read these tokens, and they do not
constrain it.
