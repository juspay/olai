# Capture

Capture owns the Inbox path and quick-capture palette action. Its server scope registers that path in the vault-owned `inbox` registry and releases the entry on withdrawal. Readers can observe absence immediately without depending on capture. Its sidebar
integration reads the inbox count while displayed; its palette integration can
run without the sidebar. A successful capture keeps the palette open for the
next line and reports where the accepted write landed. The domain write gate
retains authority over placement and persistence.

Capture owns the `+` prefix and its palette command, including the prompt,
result message and continuation for the next line. Removing the plugin withdraws
both; the navigation plugin retains no built-in capture grammar.

Chat uses this registry to file unclaimed conversation heads under a top-level
`Chats` node, matched by reserved id `chats`, with one ordinary Ops write per
conversation. Its new-chat gesture creates a child there before starting its
session. Capture's `+` text prefix remains quick capture; chat contributes its
own selectable **new chat** row to the palette. Disabling capture removes the
registry entry, stopping filing and refusing new-chat creation without making
chat wait for an unavailable service. Existing node agents remain usable.
