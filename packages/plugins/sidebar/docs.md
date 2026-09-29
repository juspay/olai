# Sidebar

`sidebar` is a browser-only row in the default bundle. It contributes the
expanded directory column and collapsed rail to `layout.sidebar`. Disabling it
removes both without replacing the open content pane or its active editor.
The `sidebar` row must be enabled to show these navigation controls; its `on` property lives in `_olai/Settings.olai`.

The entry owns `sidebar.entry` and `sidebar.section`. Contributions to these
locations wait while the sidebar or layout is absent and reactivate when their
owner returns. Their plugins' independent work remains mounted.

The column and rail implementations live here, and nothing else does: what this
package reaches for outside itself is a layer token and the slot runtime, both
`@olai/web`'s. The readings, the file creation controls and the preference rows
drawn inside the column belong to the plugins that contribute them.

The container declares `sidebar.regions` and `sidebar.rail`. Files, pins and
capture occupy these locations independently. Sidebar itself creates no
notebook reading and imports no file tree or content editor.

## What the column shows

Top to bottom: the `top` entries (Agenda, then Today with the month folded
under it, both the journal's), Inbox (capture), the plugin sections (chat's
Needs you and Chats), the pinned shelf, the file list (files: Outlines,
Reference and the `_olai/` group), and, pinned under the scrolling list, the
`foot` entries (Trash). On a phone the foot sits above the drawer's own foot
with preferences and plugins; on a desktop it shares a line with the collapse
button.

A `sidebar.entry` names where it stands with a placement word, never a pixel or
another plugin: `top`, `bottom` (after the plugin sections), or `foot` (pinned
under the list). The same entry's `rail` icon follows it; a `foot` entry's icon
sits at the rail's bottom. Sidebar draws a placement, not a contributor: the
Trash is at the foot because the trash row asked for `foot`.

Every heading in the column (Pinned, Needs you, Chats, Outlines) wears one
treatment: the words are written in Sentence case and styled as small, spaced
capitals (`olai-plugin-layout/entry`'s `REGION_LABEL`), so an accessible name
or a test reads `Outlines`, not `OUTLINES`. A heading that carries an action
(the `+` beside Chats, which starts a new chat, and the `+` beside Outlines,
which opens the New outline / New document menu) is drawn by the plugin that owns both the heading and the action,
using the shared `REGION_HEAD` and `HEAD_ACTION` paint. When that plugin's row
switches off, the heading and its `+` leave together.
