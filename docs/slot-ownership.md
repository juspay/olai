# Extension location ownership

The permanent plugin API defines generic location references and registration operations. It does not carry a notebook slot catalog or the application face types. Each capability owns its static descriptors and TypeScript contracts:

| Owner | Compatibility locations |
| --- | --- |
| Outlines | `outline.row.chip`, `.pane`, `.block`, `.door`, `.action` and property contexts |
| Navigation | `app.route`, `app.keys`, `app.command`, `app.palette` |
| Layout | `app.panel`, `app.header`, `app.banner`, `app.viewer`, `app.mount` |
| Sidebar | `sidebar.entry`, `sidebar.section` |
| Chat | `delivery.mark`, `engine.install` |

Typed consumers import the owner's `/slots` door. Owner descriptors become child declarations of the entry that consumes them. Declaring the static contract does not activate a location or create storage.

The source-compatible `Slots.register(name, ...)` facade contributes a name-only reference into the same native registry. It cannot declare an owner or choose cardinality. A registration may arrive before its owner: it waits until that owner supplies the location, then acquires its integration with the owner's key rules. Withdrawal drains that integration; returning owners acquire fresh scopes. Conflicting registrations fail rather than silently choosing a winner.

Plugin inspection reads the static descriptors exported by the bundle's capability modules. Discovery is immutable metadata, independent of the live registration table. An owner omitted from the supplied module catalog contributes no slots, and the API retains no global list between calls.
