# UI primitives

Stateless supplied-prop controls and touch-target constants. These helpers own
no subscriptions, navigation, application state or plugin registrations.

`touch.ts` also owns the app's one rule for a control that is revealed on
hover: `SHOWN_WITHOUT_HOVER` draws it at full strength under
`@media (hover: none)`. Width answers whether a control has ROOM (`md:`) and
the pointer answers whether a hover can reveal it, and the two are different
questions — a tablet in landscape is past every width breakpoint with nothing
to hover with. Every reveal recipe here (`HOVER_REVEAL`, `OFFER_REVEAL`,
`MENU_REVEAL`) carries it, and so does every hand-rolled reveal in the
plugins; a hover-only reveal that does not is a control that cannot be reached
by touch.

`testids.ts` owns identifiers for these shared controls and the type-only
`TestIdTables` interface. Each renderer augments that interface from its own
static identifier module. `AnyTestId` and `selector` therefore accept known
literal identifiers without this library importing a plugin or the bundle.
The complete runtime catalogue and cross-owner collision checks belong to
`@olai/bundle/testids`, which is the browser suite's door.
