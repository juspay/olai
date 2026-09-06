# Theme

`theme` is a browser-only provider for theme, font and type-size preferences.
It offers `theme.appearance` through its static `/contract` door. Each activation
owns fresh signals and storage listeners. User choices remain in local storage;
listeners, HTML attributes, generated favicon URLs and palette metadata are
released or restored when the provider leaves.

Its preferences integration is a separate component. It contributes controls
to `preferences.sections` only while that location exists. The provider keeps
working when preferences, the sidebar or the layout is absent, and returning
UI uses its current state. A returning provider rereads changes made while it
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
separate naming integration consumes layout's deployment reading. Chat's
separate attention integration consumes appearance and chat-owned alert state,
so losing theme withdraws the tab mark without disabling chat or its alerts.
