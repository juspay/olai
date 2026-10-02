# Outlines

Outlines supplies pages for every claim holding nodes, node addresses and the tree editor. It owns node readings and writes, selection, drag and drop, undo, row forms, folding, property editing and the Row density and Show finished preferences. Its server capability runs without a browser, renderer or layout.

Outline row carries consult the host-supplied `Landings` table before planning a move. Each editable page registers a text receiver, owns its drop line, and submits a single undoable add with title and optional note. Registrations end with the component or activation. Row moving and text receiving share `drag/places.ts` for measurable placements, independent of gesture handling. The text receiver caches geometry for one visit and uses its displayed landing as the write target; leaving clears both.

The browser provider starts before its presentation. It acquires its reading, drag and undo registers and storage observers in its activation scope. Content integrates through `navigation.content`; file creation contributes to `files.types`; settings contribute to `preferences.sections` as `{ group: "Outlines", order, body }`, so the panel files this row's controls under its own heading. File metadata belongs to the vault, so the Files sidebar is optional. Removing preferences removes only its controls. Removing Markdown removes document destinations while ordinary outline notes keep their shared Markdown text renderer.

`outlines.browser-state` carries what this row owns in a tab — its sibling
client, the undo stack, the page readings, the two drag registers, its naming of
a node and the socket its floating menus hang from — rather than announcing
readiness over values kept in module variables. The naming of a node is offered
beside it as `outlines.references`, because its consumer is the chat panel and
that panel must keep working when the outline row stops: with no provider its
chips draw the ids they carry. The overlay socket is minted and removed inside
this row's activation, so turning the row off takes the container off the page.

Every row line, on an outline page and on a day page, carries `data-menu-owner`: the row owns the menu a press on it opens, so a page-wide link menu (the tabs row's Open in new tab) leaves the links drawn inside a row to the row.

An outline page declares the row chip, pane, block, action and door locations, along with typed title, dated-row, page-shell and property-navigation extension points. Journal supplies date destinations. Markdown supplies document destinations. Missing integrations produce ordinary text or no contribution, rather than importing or starting the missing provider.

Unrelated plugin changes preserve existing editor instances and drafts. Removing outlines withdraws its pages and row locations, releases its observers, clears its focus and retained draft/form memory and prevents old reference lookups from publishing into a new activation. Restoring outlines creates a new activation and reads persisted browser preferences again.

Title blur is classified after the current DOM update. A row reorder can fire
blur while its input still reports that it is connected, then restore focus in
the same task. That redraw keeps the draft open so the next structural key acts
on the same row. A browser regression forces this ordering and verifies completion
still works; restoring the former synchronous blur handler makes it fail.

Escape also cancels a deferred editor when a split reply arrives before the page
frame that draws its new row. The focused pane handles that gap; other panes and
focused fields keep their own keyboard behavior. A cancelled split still records
its inverse, but its late reply cannot reopen the editor or replace a freshly
opened draft. Controlled reply/frame delays cover cancellation and subsequent Undo.

The package's declared contract doors carry types, location names and scoped service handles. Chat's node-reference consumers use the reference capability; they do not import the outline implementation. The shared Markdown parser and the serial undo algorithm are static libraries, with no document-plugin or outline-plugin activation of their own.

Outlines supplies pages for all node-holding kinds, node editing, zoomed views, filtering, rich
property rendering and contextual editing commands. Its server and browser
components are independently scoped. The vault supplies file access; navigation
supplies addresses and focus; the selected layout draws its content outlet.

Disabling outlines removes outline editing and its server procedures, closes its
reading subscriptions, and withdraws its property renderers. Markdown documents
continue to work. Re-enabling outlines creates fresh state from the vault; an
address retained by navigation can display its page again.

The public contracts expose page rendering and title locations for integrations
such as trash. Integrations consume those locations instead of importing outline
implementation modules. The browser owns its undo history, editor state and
palette command adapter for the lifetime of its activation.

Outlines draws every claimed file whose `holds` value is `nodes`, through one glyph and one page contribution. It does not select a format row by name.

## The filter bar

Every page that can carry a `?q=` draws the filter bar: outline pages, zoomed nodes, days, the Agenda and the Trash. The box is short and says **Filter**. Focused and empty, it opens a hint listing the grammar's forms (`filter/forms.ts`), drawn by the same completion box the row editor uses (`complete/offer.tsx` over `complete/Completions.tsx`): the popover hangs from this row's overlay socket and goes when the bar does. Arrows walk it, Enter or a click puts the form in the box with its example part selected, Escape puts it away and keeps the caret; nothing is chosen until an arrow is pressed, so Enter in an empty box still does nothing.

On an outline (and a zoom into one) the bar also draws the **Finished** box, a real checkbox whose accessible name is "Show finished": ticked shows finished work on this page, clear hides it. The page follows the Show finished preference until the box is pressed; from then on the page holds its own word, and a **Reset** link beside the box ("Use my default") hands the pick back to the preference. ⌘O writes the same word, so the box follows it. The Agenda and a day have no finished box: the pick is not about them.

## The row menu

A row's `•••` menu (a long press on the row on a phone) is short and grouped, with a rule between groups:

1. **Zoom in**, **Mark ›** (To do, Doing, Done, Cancelled, and Clear when the row has a mark; the mark the row already has is not offered), and any plugin verb that only reads.
2. **Set date…** / **Change date…**, **Set repeat…** on a dated row, and **Pin to sidebar** / **Unpin from sidebar**.
3. **Move to…** and **Duplicate**.
4. Plugin verbs that write, in bundle order. Chat's **Start an agent** is one verb when one engine can start and a submenu of engines when several can.
5. **More ›**: Copy link, Copy as text, Expand all and Collapse all (on a row with children), Add property… (on a row with no custom property), Link to…, Wait for…, Remove from here (on a mirror), Clear date and Stop repeating.
6. **Move to Trash**, last and alone. It asks before it moves anything.

A verb says which group it belongs to (`Verb.group` in `menu/verbs.ts`); `menu/actions.ts` lays the groups out. The palette lists the same verbs flat, so a mark there reads `Mark: Done`. A row's own fold is the triangle beside the `•••`, so the menu has no single-row Expand/Collapse.

A plugin hangs entries on a row through `outline.row.action`. An entry is a `RowVerb` or a `RowChoice` (`slots.ts`): a choice is one line that opens a submenu of verbs. The plugin supplies words, presses and whether the entry writes; outlines decides where the entry goes. Entry ids are `<plugin>:<id>` in `data-action`.

Submenus are Kobalte `Sub`s, portalled beside the panel into this row's overlay socket. A click or tap on a submenu's entry opens it and leaves the panel up; ArrowRight, Enter or Space opens it from the keyboard with the caret on its first entry, and ArrowLeft closes it and gives the caret back to the entry. On a phone a submenu overlaps the panel instead of hanging off the screen. A verb that asks first (Move to Trash, chat's Fresh start) swaps the whole panel for the question, with the caret on the answer.

## Rows on a phone

The row the caret or the last tap is on carries `data-active`. A plugin's offer on a row (chat's `Start an agent` pill, styled with `OFFER_REVEAL` from `@olai/ui-primitives/touch.ts`) is drawn on a phone only on that row; on a pointer device it appears on hover or keyboard focus. What a row already has, such as an agent's standing, is drawn on every row. A dated row on a day page or the Agenda becomes the active row when tapped.

## Empty pages

With no outlines at all the page says **No outlines yet** and offers **New outline**, which opens the files row's own new-file box through `files.state` (`browser/files.tsx`). With no files row mounted there is no box and no button. A path that names nothing says **Page not found**, names what was asked for, and offers **Go home**.

## Tool reply story

The browser activation registers its `tool.reply` face. Chat owns the frame, file span and fold; outlines reads a top-level file and projects the write reply’s story fields to draw its change glyph, node title, classification and nudge. Reads and refusals have no story; an unchanged write says “nothing changed”. The face owns node navigation through outlines’ existing focus helper; the generic slot receives only the reply. Registration belongs to the outlines activation and withdraws with it; outlines imports no chat implementation.

The reference service preserves both the resolved node ID and its title from
`nodes.named`. Navigation reads the ID; chat context chips read the title. Both
share the same scoped, batched lookup and withdraw with the provider.

## What the row tells an agent

Beside its tools, the outlines sibling carries one `charter` paragraph that the MCP row composes into `initialize`'s `instructions` while this row stands ([mcp.md](mcp.md), "What `initialize` says"): a node's note is read by a person — `Note.tsx` draws it as markdown under the title and as the node's page — so an agent writes it as well-formed markdown for that reader, never a raw tool result or a wall of text. The tool line on `outlines_desc` says the note is stored verbatim; this says who reads it back. `src/charter.ts` argues the sentence, and the paragraph leaves the wire with the row.

## Retained pane state

The pane owns its editor memory, selection and landing state. Pane indices can
change without resetting them. Navigating to another subject resets editing;
a temporarily missing file can recover its unfinished draft in the same pane.
Hidden panes ignore bulk keys and focus requests and hide their overlays.
Temporary finished-row reveals are keyed by pane id, so two tabs of one file
share saved edits while keeping separate landing courtesy.

Done and filter pruning preserve each surviving store row's identity. Property
faces are keyed by property name, and replacement values update their props.
Caret, selection, fold and focus selectors notify only affected rows. Names,
doors and licences expose stable per-key readings. Row elements register with
the outlines activation for scoped landings; declaration batches, focus work
and temporary done reveals also leave with that activation.

Switching tabs suspends an open row menu, including its confirmation, submenu,
and focused entry. Returning restores that entry without recreating the panel.
A pointer elsewhere on the current page still dismisses the menu normally.
