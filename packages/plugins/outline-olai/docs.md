# Outline files

olai keeps outlines in `.olai` files, and this row is what reads and writes
them. Everything made of rows stands on it: outline pages, the inbox, pins,
Trash and `/agenda`. The file format itself is
[the format reference](../format.md).

## Turning it off

olai's own settings live in an outline, `_olai/Settings.olai`, so the settings
file cannot switch off the row that reads it. The **Outline files** switch in
the **Plugins** panel is session-only, says **Resets when olai restarts**, and
an `on` written for this row in the settings file is ignored with a warning in
the log.

While the row is off:

- outlines leave the sidebar, and `files_create` refuses with `the outline-olai
  row is off, so no outline can be created`;
- Trash, the inbox, pins and `/agenda` are unavailable;
- olai stops reading its settings file until the row comes back. Settings
  already applied to other rows stay in force.

Turning the row on reads your outlines back without a browser reload.
