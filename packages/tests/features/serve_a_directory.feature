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
    When I open the app
    Then the outline list has 2 entries
    And the outline list links to "garden.jsonl"
    And the outline list links to "house.jsonl"

  Scenario: Documents are not outlines
    # finishes.md is served — `install` attaches it — but it is a document, not
    # an outline: its link is a document link, not an outline one.
    When I open the app
    Then the outline list does not link to "finishes.md"

  Scenario: Nested paths are folders, not path strings
    # notes/palette.md lives under notes/, so the tree draws a folder and the
    # basename — never the wrapped "notes/palette.md" string the flat list used
    # to spell. Collapsing hides the document; expanding brings it back. The
    # fold is client-local: the page does not reload.
    When I open the app
    Then the file tree shows the folder "notes"
    And the folder "notes" is expanded
    And the document link "notes/palette.md" is shown
    Given I mark the page
    When I collapse the folder "notes"
    Then the folder "notes" is collapsed
    And the document link "notes/palette.md" is hidden
    When I expand the folder "notes"
    Then the folder "notes" is expanded
    And the document link "notes/palette.md" is shown
    And the page has not reloaded
