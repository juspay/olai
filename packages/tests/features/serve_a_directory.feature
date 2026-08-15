@corpus:good
Feature: Serve a directory
  Olai is pointed at one directory and serves what it finds there. Every
  `.jsonl` under it is an independent outline, every `.md` a document, and the
  sidebar is one file TREE of both — so this is the first thing that has to be
  true, and the cheapest thing to be wrong about (a mis-globbed extension, a
  path that reads as absolute in the browser and relative on disk).

  Scenario: The app mounts
    When I open the app
    Then the outline list is shown
    And there should be no page errors

  Scenario: Every outline in the directory is listed
    # A root outline so no folder is force-opened for ancestry: only the two
    # root outlines show until Daily is unfolded (or someone opens a nested file).
    Given I open the outline "house.jsonl"
    Then the outline list has 2 entries
    And the outline list links to "garden.jsonl"
    And the outline list links to "house.jsonl"
    When I expand the folder "Daily"
    Then the outline list links to "Daily/2026-08.jsonl"
    And the outline list has 3 entries

  Scenario: Documents are not outlines
    # finishes.md is served — `install` attaches it — but it is a document, not
    # an outline: its link is a document link, not an outline one.
    When I open the app
    Then the outline list does not link to "finishes.md"

  Scenario: Nested paths are folders, collapsed by default
    # Nested files live under folders, so the tree draws a folder and the
    # BASENAME — never the wrapped path string the flat list used to spell.
    # Folders start shut so a deep corpus is not a wall of paths; a root
    # outline (house) has no ancestors, so both folders stay collapsed until
    # the reader opens one. Expanding shows the children; collapsing hides
    # them again. The fold is client-local, and this browser remembers which
    # folders are open (`folds_are_remembered.feature`).
    Given I open the outline "house.jsonl"
    Then the file tree shows the folder "Daily"
    And the file tree shows the folder "notes"
    And the folder "Daily" is collapsed
    And the folder "notes" is collapsed
    And the document link "notes/palette.md" is hidden
    Given I mark the page
    When I expand the folder "notes"
    Then the folder "notes" is expanded
    And the document link "notes/palette.md" is shown
    And the document link "notes/palette.md" reads "palette.md"
    When I collapse the folder "notes"
    Then the folder "notes" is collapsed
    And the document link "notes/palette.md" is hidden
    And the page has not reloaded
    When I expand the folder "Daily"
    Then the outline link "Daily/2026-08.jsonl" reads "2026-08.jsonl"

  Scenario: Every row says what kind of thing it is
    # Filed from a screenshot: an outline, a document and a folder were three
    # words in the same ink, and the only thing telling the first two apart was
    # the extension at the end of the name. Each row now carries its kind's
    # glyph in front of the name (`client/file/icons.tsx`) — which is a fact
    # about the row, so it is asserted as one.
    Given I open the outline "house.jsonl"
    Then the outline link "house.jsonl" is drawn as an outline
    And the outline link "garden.jsonl" is drawn as an outline
    And the document link "finishes.md" is drawn as a document
    And the folder "notes" is drawn as a folder
    And the folder "Daily" is drawn as a folder

  Scenario: Opening a nested file expands its folder chain
    # The selection must never hide under a shut parent. Landing on a nested
    # path force-opens its ancestors for the duration of that page; folders
    # the reader has not toggled stay collapsed when the selection moves away.
    When I open the document "notes/palette.md"
    Then the folder "notes" is expanded
    And the document link "notes/palette.md" is shown
    And the folder "Daily" is collapsed
    When I open the outline "house.jsonl"
    Then the folder "notes" is collapsed
    And the document link "notes/palette.md" is hidden
