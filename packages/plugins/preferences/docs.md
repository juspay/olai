# Preferences

`preferences` is a browser-only UI row. It contributes a tool to `layout.tools`,
which the shell places in the desktop header or mobile directory footer. Its
entry owns `preferences.sections`; other plugins contribute their controls
there without importing the panel implementation.

The theme provider contributes Theme, Font and Size controls. Disabling this
UI removes its panels and those contributions while the theme provider keeps
following stored preferences. Re-enabling the UI reads the existing provider.
Disabling theme removes its controls without removing the rest of the panel.

Notes, Done and alert controls still use shared notebook implementations during
the remaining content extraction. Their provider state does not belong to this
UI. Those controls will move to integrations owned by their respective feature
plugins before Phase 18 is complete.
