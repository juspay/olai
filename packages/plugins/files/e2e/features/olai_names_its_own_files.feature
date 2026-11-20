@scratch:good
Feature: The files olai names for itself, and the doors onto them
  A served directory is somebody's — their outlines, at the top level where
  they put them. A file OLAI made because they pressed something goes under
  `_olai/`: the shelf, the trash, and now the inbox.

  Those files were being drawn TWICE. `_olai/` was an ordinary folder in the
  file tree, so `_olai/Pins.olai` sat there as a row even though the shelf
  above it already IS that file's face — and the trash has had a door of its
  own at the foot of the column since it was written. Then came a Prefs
  switch to draw them again — and that was the wrong half: inspectability a
  reader has to OPT INTO is inspectability they have to know to ask for.

  So the tree goes on keeping the reader's rows, and the `_olai/` outlines
  get a HOME of their own: one special parent at the foot of the column,
  named for the house itself (ruled 2026-08-31: one mechanism, one
  parent, one door for the vault's own furniture), whose rows open each
  as the ordinary outline it is — and the Trash door nests with them.
  It is still a DRAWING rule and not a set rule, which is the line these
  scenarios keep: the files stay in the directory either way, and nothing
  here touches search, an agent's `outlines_index`, the trash page or the
  shelf.

  The INBOX moved under `_olai/` with them (human, 2026-08-20, reversing
  format.md's "deliberately NOT"), and it got the door that goes with being
  out of the tree. That door then moved UP beside Agenda (human, 2026-08-20,
  screenshot ruling) — a primary destination, not a foot-door with Trash —
  and it wears Agenda's own count badge: how many rows in the inbox are
  marked `todo` or `doing` — any depth; an unmarked row is furniture —
  hidden at zero.
  Conventions now match stems directly under `_olai/`. A root-level
  `Inbox.olai` is an ordinary outline; capture and the Inbox door agree on
  the convention file instead.

  `@scratch:` because these write the directory they are served.

  Background:
    Given I open the outline "house.olai"

  Scenario: A minted shelf is the shelf, and not also a row in the tree
    When I pin the page
    Then the pinned shelf holds "/house.olai"
    And "_olai/Pins.olai" holds a node titled "/house.olai"
    But the outline list does not link to "_olai/Pins.olai"
    And the file tree does not show the folder "_olai"
    And there should be no page errors

  Scenario: The reader's own files are untouched by the rule
    When I pin the page
    Then the outline list links to "house.olai"
    And the file tree shows the folder "Daily"
    When I expand the folder "Daily"
    Then the outline list links to "Daily/2026-08.olai"

  Scenario: The vault group is the way into the files olai named
    When I pin the page
    Then the vault group links to "_olai/Pins.olai"
    And the vault group sits below the file tree
    When I open "_olai/Pins.olai" from the vault group
    Then the address is "/_olai/Pins.olai"
    And the outline has 1 rows
    And the vault group's "_olai/Pins.olai" row marks the current page
    And there should be no page errors

  Scenario: The furniture nests under one parent, and the Trash stands at the foot
    Then the Trash door stands at the sidebar's foot, outside the group
    When I pin the page
    Then the vault group is one parent named "olai"
    And the parent nests the vault group's "_olai/Pins.olai" row
    And the Trash door stands at the sidebar's foot, outside the group
    And there should be no page errors

  Scenario: The trash is out of the tree either way, because it is not a file you edit
    When I pin the page
    And I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "install"
    And the vault group links to "_olai/Pins.olai"
    But the vault group does not link to "_olai/Trash.olai"
    And the outline list does not link to "_olai/Trash.olai"

  Scenario: An outline that will not parse is marked in the group, not hidden
    When I pin the page
    Then the pinned shelf holds "/house.olai"
    And the vault group links to "_olai/Pins.olai"
    When I rewrite "_olai/Pins.olai" as:
      """
      {"id":"p0","ord":"a0",title:"/house.olai"}
      """
    Then the vault group's "_olai/Pins.olai" row is marked unreadable
    And the outline list does not link to "_olai/Pins.olai"

  Scenario: A file added under _olai/ joins the group as it lands
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"watch","ord":"a0","title":"watch"}
      """
    Then the vault group links to "_olai/Settings.olai"
    But the outline list does not link to "_olai/Settings.olai"
    And there should be no page errors

  Scenario: A directory that has never captured offers no Inbox
    Then the sidebar offers no Inbox
    And there should be no page errors

  Scenario: A capture mints _olai/Inbox.olai, and the Inbox entry opens it
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then "_olai/Inbox.olai" holds a node titled "buy the walnut stain"
    When I close the palette
    Then the sidebar offers the Inbox
    And the outline list does not link to "_olai/Inbox.olai"
    And the vault group links to "_olai/Inbox.olai"
    When I open the Inbox from the sidebar
    Then the address is "/_olai/Inbox.olai"
    And the outline has 1 rows
    And there should be no page errors

  Scenario: An inbox that will not parse says so on its own door
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then "_olai/Inbox.olai" holds a node titled "buy the walnut stain"
    When I close the palette
    And I rewrite "_olai/Inbox.olai" as:
      """
      {"id":"i0","ord":"a0",title:"buy the walnut stain"}
      """
    Then the Inbox door is marked unreadable
    And the Inbox wears no count

  Scenario: A root-level Inbox is an ordinary outline, not the capture convention
    When I create the outline "Inbox.olai" from the sidebar
    Then the sidebar offers no Inbox
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then "_olai/Inbox.olai" holds a node titled "buy the walnut stain"
    And "Inbox.olai" holds exactly 0 nodes titled "buy the walnut stain"
    When I close the palette
    Then the sidebar offers the Inbox
    And the outline list links to "Inbox.olai"
    And the vault group links to "_olai/Inbox.olai"
    When I open the Inbox from the sidebar
    Then the address is "/_olai/Inbox.olai"
    And there should be no page errors

  Scenario: The Inbox sits beside Agenda, not down with Trash
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    When I close the palette
    Then the sidebar offers the Inbox
    And Inbox sits beside Agenda
    And there should be no page errors

  Scenario: The Inbox wears a count of what it holds, and the count moves as captures land
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    When I close the palette
    Then the Inbox wears a count of 1
    And I mark the page
    When I press the palette shortcut
    And I capture "and a tin of oil" from the palette
    When I close the palette
    Then the Inbox wears a count of 2
    When I rewrite "_olai/Inbox.olai" as:
      """
      """
    Then the Inbox wears no count
    And the sidebar offers the Inbox
    And the page has not reloaded
    And there should be no page errors

  Scenario: An empty inbox wears no count
    When I create the outline "_olai/Inbox.olai" from the sidebar
    Then the sidebar offers the Inbox
    And the Inbox wears no count
    And there should be no page errors

  Scenario: A later root Inbox does not replace the convention or its count
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    When I close the palette
    Then the Inbox wears a count of 1
    When I create the outline "Inbox.olai" from the sidebar
    Then the Inbox wears a count of 1
    And the address is "/Inbox.olai"
    When I open the Inbox from the sidebar
    Then the address is "/_olai/Inbox.olai"
    And there should be no page errors
