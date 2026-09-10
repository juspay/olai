# Preferences

`preferences` is a browser-only UI row. It contributes a tool to `layout.tools`,
which the shell places in the desktop header or mobile directory footer. Its
entry owns `preferences.sections`; other plugins contribute their controls
there without importing the panel implementation.

The theme provider contributes Theme, Font and Size controls. Disabling this
UI removes its panels and those contributions while the theme provider keeps
following stored preferences. Re-enabling the UI reads the existing provider.
Disabling theme removes its controls without removing the rest of the panel.

The Notes and Done rows are contributed by `outlines` and the alert rows by
`chat`, each into `preferences.sections` from its own browser half. Their
provider state does not belong to this UI, and this package holds no control of
theirs: the panel is a shell, and a row arrives with the plugin that owns what
it sets.
