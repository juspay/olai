# UI renderer

`ui-renderer` is a browser-only row selected by the default web bundle. The
host supplies a mount element through `BrowserMount`; this plugin owns the
Solid root, its disposal and the location registry. It provides
`ui-renderer.slots`. Its static `/contract` export carries the typed root
location and service contract without importing presentation code.

Only `root` is permanent, and it permits one contribution. Other locations
are declarations acquired on a plugin's scope, with a named parent and either
one or many occupants. A contribution made before its location is declared
waits without blocking independent work by its plugin. Withdrawing an
ancestor hides dependent contributions; restoring the ancestor makes them
eligible again. Duplicate declarations, ownership cycles and incompatible
cardinality fail with the responsible owners named.

The registry preserves surviving contribution identity across unrelated
changes. Registrations and declarations release with their scopes; a failed
initialization leaves neither behind. `inspect()` distinguishes active and
waiting contributions and names the missing location.

The server does not import this plugin's browser module. Its loader fiber
records selection, and its roster says `browserOnly: true`. The plugin panel
shows browser activation separately from host selection. Headless profiles
do not select this row.

This is the renderer foundation for Phase 18. The remaining application
locations still use the earlier slot API until their owners are extracted.
