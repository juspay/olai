# Capture

Capture owns the Inbox path and quick-capture palette action. Its server scope registers that path in the vault-owned `inbox` registry and releases the entry on withdrawal. Readers can observe absence immediately without depending on capture. Its sidebar
integration reads the inbox count while displayed; its palette integration can
run without the sidebar. A successful capture keeps the palette open for the
next line and reports where the accepted write landed. The domain write gate
retains authority over placement and persistence.

Capture owns the `+` prefix and its palette command, including the prompt,
result message and continuation for the next line. The command reads
`Capture to the Inbox`; a bare `+` hints `Type a line after + to add it to the
Inbox`; a successful capture says `Captured “line” to <file>`. Removing the plugin withdraws
both; the navigation plugin retains no built-in capture grammar.

Chat uses this registry to file unclaimed conversation heads under a top-level
`Chats` node, matched by reserved id `chats`, with one ordinary Ops write per
conversation. Chat's **New chat** palette row offers **Inbox › Chats** as its
Default place exactly while this registry has an entry, and creates a child
here only when that place is chosen. Capture's `+` text prefix remains quick
capture; New chat is chat's own palette row. Disabling capture removes the
registry entry, stopping filing and withdrawing the Default place without
making chat wait for an unavailable service; other places still work. Existing
node agents remain usable.

Inbox is found by its convention stem directly under `_olai/`, among
node-holding claims. When the configured outline row is off, the Inbox sidebar
entry names it using the vault's live `outlineRow` (`Inbox needs
outline-olai, which is turned off.`); the Inbox file itself is
an ordinary address and reports its unclaimed suffix.
