# Olai

Olai claims the `.olai` outline format and owns its pure JSONL parser and canonical writer. It draws nothing: Outlines contributes one glyph and tree page for every claim holding nodes.

A format receives the file path, contents and the caller's Claims snapshot. It never reads the live registry. The vault's codec, write gate and outline-diff procedure choose the format and pass the same snapshot used for their decision.

Its switch is session-only while it owns the settings file's suffix. Turning it off withdraws all its files and the settings reading; previously applied settings for other rows remain in force. A durable `on: no` for this reader is ignored with a warning. Turning it back on reprobes the files without a browser reload.
