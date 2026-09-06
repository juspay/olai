# Outlines

Outlines supplies `.olai` pages, node addresses and the tree editor. It owns node readings and writes, selection, drag and drop, undo, row forms, folding, property editing and the Notes and Done preferences. Its server capability runs without a browser, renderer or layout.

The browser provider starts before its presentation. It acquires its reading, drag and undo registers and storage observers in its activation scope. Content integrates through `navigation.content`; file creation contributes to `files.types`; settings contribute to `preferences.sections`. File metadata belongs to the vault, so the Files sidebar is optional. Removing preferences removes only its controls. Removing Markdown removes document previews and document destinations while ordinary outline notes keep their shared Markdown text renderer.

An outline page declares the row chip, pane, block, action and door locations, along with typed title, dated-row, page-shell, document-reference and property-navigation extension points. Journal supplies date destinations. Markdown supplies document destinations and previews. Missing integrations produce ordinary text or no contribution, rather than importing or starting the missing provider.

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

Outlines supplies outline pages, node editing, zoomed views, filtering, rich
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
