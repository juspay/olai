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

- **Theme** — eighteen swatches: the eight hue families, lights first then
  darks, then the two neutral picks, each painted in its
  palette's paper with a wedge of its accent. A swatch carries no word: its
  name is its tooltip and accessible name, and the theme in force is named once
  beside the row's label. Tab reaches the swatches and Space or Enter picks one;
  the panel stays open, because a palette is judged on the page it paints.
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
Pure appearance tables, CSS generators and mark drawing live in
`@olai/appearance`; the typeface catalog remains `@olai/fonts`. Their import
graphs acquire no observers or DOM state.

Chrome state is freshly acquired with the appearance provider, including title,
favicon blob and theme metadata. Cleanup restores inherited values, revokes
blobs and invalidates retained writers. `theme.appearance.chrome` carries the
name/waiting behaviors; other plugins never import its implementation. A
separate naming integration consumes layout's deployment reading. The `alerts`
row's separate tab-attention integration consumes appearance and the alerts
channel, so losing theme withdraws the tab mark without disabling chat, the
journal's reminders or the alerts themselves.

Deployment naming follows its own scoped source. Withdrawing the layout's name
source restores the inherited document and Apple title without stopping theme
state or the chat unread marker. A returning source starts a fresh naming
subscription and updates those titles again.
