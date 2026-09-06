# Alternate layout fixture

A maintained acceptance fixture, shipped disabled and selected only explicitly
by tests. It occupies `root`, declares `navigation.content`, and renders the
navigation service's page outlet. It imports no layout, outline or Markdown
implementation. Its two test navigation controls open corpus files through the
same history service used by the normal layout.

`alternate_layout.feature` proves the unchanged outline editor writes through
its domain provider, Markdown renders under the same fixture, and navigation
between them preserves the mounted application. This is not a second production
shell or a settings option.
