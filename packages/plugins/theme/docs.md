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

The palette/font definitions, generated styles, early no-flash boot script and
shared deployment-title/attention chrome helpers still live in shared packages.
Moving those build and chrome boundaries is part of the remaining Phase 18
work; this extraction establishes the provider and integration lifetimes.
