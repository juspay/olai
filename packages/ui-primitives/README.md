# UI primitives

Stateless supplied-prop controls and touch-target constants. These helpers own
no subscriptions, navigation, application state or plugin registrations.

`testids.ts` owns identifiers for these shared controls and the type-only
`TestIdTables` interface. Each renderer augments that interface from its own
static identifier module. `AnyTestId` and `selector` therefore accept known
literal identifiers without this library importing a plugin or the bundle.
The complete runtime catalogue and cross-owner collision checks belong to
`@olai/bundle/testids`, which is the browser suite's door.
