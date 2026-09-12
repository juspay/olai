# CSV

CSV claims comma-separated text files and draws a bounded table preview and file glyph. It reads fresh unkept text through `vault.files.body`; CSV data is never exposed through the media route.

The vault refuses a body read unless the current claim is unkept text. Markdown's declared metadata reader supplies the page's referrers. The table and glyph have separate component lifetimes, and the table retains its row and column limits and refusal display.

Page metadata is read from `vault.files.bodyPage`; disabling Markdown does not withdraw this page.
