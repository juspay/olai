# CSV

CSV claims comma-separated text files and draws a bounded table preview and file glyph. It reads fresh unkept text through `vault.files.body`; CSV data is never exposed through the media route.

The vault refuses a body read unless the current claim is unkept text. Markdown's declared metadata reader supplies the page's referrers. The table and glyph have separate component lifetimes, and the table retains its row and column limits and refusal display.

A file with no rows says `This file is empty.` instead of drawing an empty table. When a limit is reached, a quiet line under the table says what is shown, such as `Showing the first 500 rows.`, and `Long cells are cut at N characters.` when a cell was shortened.

Page metadata is read from `vault.files.bodyPage`; disabling Markdown does not withdraw this page.

## Live revisions

A revision fetch keeps the previous table drawn until its replacement arrives.
Existing positional rows and cells update in place. Missing files and refused
reads still show their absence or refusal instead of retaining stale data.
