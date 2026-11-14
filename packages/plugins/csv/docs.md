# CSV

CSV claims comma-separated text files and draws a bounded table preview and file glyph. It reads fresh unkept text through `vault.files.body`; CSV data is never exposed through the media route.

The vault refuses a body read unless the current claim is unkept text. Markdown's declared metadata reader supplies the page's referrers. The table and glyph have separate component lifetimes, and the table retains its row and column limits and refusal display.

A file with no rows says `This file is empty.` instead of drawing an empty table. When a limit is reached, a quiet line under the table says what is shown, such as `Showing the first 500 rows.`, and `Long cells are cut at N characters.` when a cell was shortened.

Page metadata is read from `vault.files.bodyPage`; disabling Markdown does not withdraw this page.

## The table a keyboard can reach

A `.csv` is somebody's export, so the table it draws is routinely wider and
taller than the lane it is drawn in. It scrolls inside its own region rather
than widening the page, and that region is reachable: it carries `tabindex="0"`
so the arrow keys move it, `role="region"` so arriving in it is announced, and
its accessible name is the file's path — said once as the table's `<caption>`
and borrowed by the region through `aria-labelledby`. The caption is not drawn,
because the page's heading is already that path in full.

Focus on the scroller wears the app's one ring, drawn two pixels outside the
box. A focusable scroll container is where such a ring is usually lost, so the
geometry is held rather than assumed: the pane around the table clips at its
padding box, and that padding is wider than the ring. A scenario reads the ring
as a rectangle inside the rectangles that clip it, not as a class name.

Header cells carry `scope="col"`, which is the fact the format states — the
first row of a `.csv` is the header. No cell claims to be a row header: a `.csv`
says nothing about its first column. The header row stays against the top of the
scroller while the rows move under it, which is why the table's borders are
separate rather than collapsed and why the header draws on an opaque surface.
The scroller's height is bounded (`min(32rem, 80vh)`), which is what gives the
sticky header something to stick to and bounds how much of the pane one file may
claim.

## Live revisions

A revision fetch keeps the previous table drawn until its replacement arrives.
Existing positional rows and cells update in place. Missing files and refused
reads still show their absence or refusal instead of retaining stale data.
