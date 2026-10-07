# Self-drawn page fixture

A maintained acceptance fixture, shipped disabled and selected only explicitly
by tests. It registers one `app.route` page of the **self-drawn** kind
(`defineSelfDrawnRoute` / `defineSelfDrawnPage`,
[navigation.md](navigation.md#plugin-pages)) and one palette row, **Go to
fixture alpha**, that goes to it. It names no document-format page type, no
page reading and no outlines code: the point is that a plugin page needs none
of them.

`/fixture/<word>` is the page for one lowercase word (`alpha`, `beta`,
`gamma`); anything else under `/fixture/` is claimed and refused. The page
shows its word and links to the other two with real anchors, so navigation's
link listener answers plain click, Alt and Alt-Shift on them like any link. Its
breadcrumb, and so its tab title and pane label, is `Fixture <word>`.

`self_drawn_pages.feature` ([navigation.md](navigation.md#plugin-pages)) drives
it. This is not a feature anyone turns on.
