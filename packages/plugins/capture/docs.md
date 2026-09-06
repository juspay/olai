# Capture

Capture owns the inbox entry and quick-capture palette action. Its sidebar
integration reads the inbox count while displayed; its palette integration can
run without the sidebar. A successful capture keeps the palette open for the
next line and reports where the accepted write landed. The domain write gate
retains authority over placement and persistence.

Capture owns the `+` prefix and its palette command, including the prompt,
result message and continuation for the next line. Removing the plugin withdraws
both; the navigation plugin retains no built-in capture grammar.
