# Theme

`theme` is a browser-only provider for theme, font and type-size preferences.
It offers `theme.appearance` through its static `/contract` door. Each activation
owns fresh signals and storage listeners. User choices remain in local storage;
listeners, HTML attributes, generated favicon URLs and palette metadata are
released or restored when the provider leaves.

Its preferences integration is a separate component. It contributes the
**Appearance** heading's rows to `preferences.sections` (`heading:
"appearance"`, a key of preferences' `HEADINGS` table, which puts it first in
the panel; `order: 0` within it) only while that location exists:

- **Theme** — a *Follow the system* control, then four swatches: `chalk` and
  `reef` (light), `basalt` and `abyss` (dark), every swatch painted in its
  palette's paper with a wedge of its accent. A swatch carries no word: its
  name is its accessible name and the app's own tip says the same thing to a
  pointer, and the theme in force is named
  once beside the row's label — `System · Chalk` while the OS is choosing,
  the bare name once a swatch has been picked. A page that has picked nothing
  follows `prefers-color-scheme` between `chalk` and `basalt`; a pick wins
  over the OS until the follow control hands the question back. Tab reaches
  the swatches and Space or Enter picks one; the panel stays open, because a
  palette is judged on the page it paints.
- **Font** — a select of the `@olai/fonts` catalog. The default, `olai`, sets
  titles and documents in Literata, the interface in Inter and code in iA
  Writer Mono.
- **Size** — the root font size, which moves every `rem` in the client.

No row carries a line under it: each label says what its control sets.

The provider keeps working when preferences, the sidebar or the layout is
absent, and returning UI uses its current state. A returning provider rereads changes made while it
was absent. Unknown stored choices are forgotten; unavailable storage still
permits temporary choices for the current activation.

The row's `/assets` build contribution owns the first-paint preference script,
palette/size/scale CSS generation and hosted font installation. Bundle generation
discovers static asset exports from its rows; the web builder consumes their
generic head, stylesheet, preload and installation hooks without naming theme.
The head it contributes also asks for the default typeface's three regular
upright files (`@olai/fonts`'s `fontPreloadHtml`) before the sheet does, so
the first text set in them is set in them: a hosted face is `font-display:
swap`, and a swap after first paint moves every line above wherever a reader
landed. A document's own landing waits for `document.fonts.ready` for the same
reason ([markdown.md](markdown.md)).

That script restores four things, three of them attributes on `<html>`
(`data-theme`, `data-font`, `data-size`) and the fourth the browser's own
`<meta name="color-scheme">`. The canvas behind the document, the scrollbars
and the form controls are the UA's to paint, and before the stylesheet lands
that meta is the only thing that tells it which way they go — so a dark
palette picked under a light OS used to spend the whole pre-sheet window in a
light browser's chrome. The shell authors the meta as `light dark`, which is
what a page whose JavaScript never ran shows and is the word for "follow the
OS"; the script overwrites it only from `olai.scheme`, a copy of the picked
palette's `scheme` that the provider stores beside the pick itself
(`@olai/appearance/palettes.ts`). The script learns no theme name and no
theme's polarity: it copies a word it was handed. A browser whose storage
predates that key follows the OS for one load and is written up by the next.

Pure appearance tables, CSS generators and mark drawing live in
`@olai/appearance`; the typeface catalog remains `@olai/fonts`. Their import
graphs acquire no observers or DOM state.

Chrome state is freshly acquired with the appearance provider, including title,
favicon blob and theme metadata. The shell ships two `theme-color` metas, one
per `prefers-color-scheme`, so an unpicked page has the right status bar before
the bundle runs; a pick repaints **both** of them, because the browser uses the
first meta whose media query matches and a dark palette under a light OS is
answered by the second one. The `media` attributes are never touched: they are
the shell's statement about a page nobody has picked on, and cleanup hands both
metas back exactly as they were found, along with the canvas meta, the title,
the favicon and the Apple title; it also revokes the mark's blobs and
invalidates retained writers. `theme.appearance.chrome` carries the
name/waiting behaviors; other plugins never import its implementation. A
separate naming integration consumes layout's deployment reading. The `alerts`
row's separate tab-attention integration consumes appearance and the alerts
channel, so losing theme withdraws the tab mark without disabling chat, the
journal's reminders or the alerts themselves.

Deployment naming follows its own scoped source. Withdrawing the layout's name
source restores the inherited document and Apple title without stopping theme
state or the chat unread marker. A returning source starts a fresh naming
subscription and updates those titles again.

## When the screen is not olai's to paint

Two system preferences arrive without passing through this row's controls, and
olai answers both in the sheet this row owns (`@olai/appearance/chrome.css`).

**High Contrast.** On a screen that forces its own colours, the browser throws
olai's palette away and repaints from the reader's own set — and deletes every
`box-shadow` on the way. The keyboard's focus ring survives that, because it
is an outline and not a shadow; it is drawn around the same controls as ever,
in the screen's own highlight colour. Controls that said their state in a
background alone say it again from the system palette: a switch's on and off,
the segment of a strip that is in force, the selected tab of a ledger, and the
small round marks that stand for an agent's standing, a live turn or a
transaction's status. The **Theme** swatches are the one exception in olai and
they are exempt on purpose: a palette preview whose whole content is colour has
nothing left to say once its colours are taken, so the discs keep theirs and
the buttons around them do not.

**More contrast.** The overflow bar is deliberately quiet — a quarter of the
surface's ink, a hint rather than a furnishing. A reader who asks their system
for more contrast gets the thumb at the full ink of whichever palette is in
force, light or dark, rather than a black that would be a stranger on four of
them. The track stays clear in both: a Mac draws it transparent whatever a page
asks, so the thumb is made to read against the page instead.

Both follow the system setting live; there is nothing to reload.

