# Outline files

olai keeps outlines in `.olai` files, and the `outline-olai` plugin is what reads and writes them.[^stands]

## Turning it off

olai's own settings live in an outline, `_olai/Settings.olai`, so the settings file cannot switch off the plugin that reads it. The **Outline files** switch in the **Plugins** panel lasts only until olai restarts, and says **Resets when olai restarts**.[^ignored]

While the plugin is off:

- outlines leave the sidebar, and `files_create` refuses with `the outline-olai row is off, so no outline can be created`;
- the Trash, the inbox, pins and the agenda page at `/agenda` are not available;
- olai stops reading its settings file until the plugin comes back.[^applied]

Turning the plugin on reads your outlines back without reloading the browser.

[^stands]: Everything made of rows, which are the lines of an outline, needs this plugin: outline pages, the inbox, pins, the Trash and the agenda page. The file format itself is [the format reference](../format.md).

[^ignored]: An `on` property written for this plugin in the settings file is ignored, and olai writes a warning to the log.

[^applied]: Settings olai has already applied to other plugins stay in force while this plugin is off.
