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
  here touches search, an agent's `list_outlines`, the trash page or the
  shelf.

  The INBOX moved under `_olai/` with them (human, 2026-08-20, reversing
  format.md's "deliberately NOT"), and it got the door that goes with being
  out of the tree. That door then moved UP beside Agenda (human, 2026-08-20,
  screenshot ruling) — a primary destination, not a foot-door with Trash —
  and it wears Agenda's own count badge: how many rows in the inbox are
  marked `todo` or `doing` — any depth; an unmarked row is furniture —
  hidden at zero.
  Only the MINT moved as to WHICH file — a directory that already keeps
  its own `Inbox.olai` goes on capturing into the file it has, and this
  entry opens whichever file that is.

  `@scratch:` because these write the directory they are served.

  Background:
    Given I open the outline "house.olai"

  # ── the tree stops drawing them; the group at the foot keeps them ────

  Scenario: A minted shelf is the shelf, and not also a row in the tree
    # THE BUG, as a scenario. Pinning mints `_olai/Pins.olai`; before this
    # change the tree grew an `_olai` folder holding a `Pins` row, a second way
    # into the file the shelf directly above it already draws.
    When I pin the page
    Then the pinned shelf holds "/house.olai"
    And "_olai/Pins.olai" holds a node titled "/house.olai"
    But the outline list does not link to "_olai/Pins.olai"
    And the file tree does not show the folder "_olai"
    And there should be no page errors

  Scenario: The reader's own files are untouched by the rule
    # The fence against a filter that reached too far: only `_olai/` goes, and
    # only at the root. Folders start collapsed, so a file inside one is
    # reached the way a reader reaches it.
    When I pin the page
    Then the outline list links to "house.olai"
    And the file tree shows the folder "Daily"
    When I expand the folder "Daily"
    Then the outline list links to "Daily/2026-08.olai"

  # ── the vault group: a home, not a switch ────────────────────────────

  Scenario: The vault group is the way into the files olai named
    # THE REPLACEMENT RULING. Where the Prefs switch needed finding and
    # flipping, the group needs nothing: the pin mints the file and the row
    # is THERE, in Trash's register, below every row of the reader's own.
    When I pin the page
    Then the vault group links to "_olai/Pins.olai"
    And the vault group sits below the file tree
    When I open "_olai/Pins.olai" from the vault group
    Then the address is "/_olai/Pins.olai"
    And the outline has 1 rows
    And the vault group's "_olai/Pins.olai" row marks the current page
    And there should be no page errors

  Scenario: The furniture nests under one parent, and the Trash is in it
    # THE 2026-08-31 RULING: one mechanism, one parent, one door for the
    # house's own furniture — the group's rows AND the Trash sit under a
    # row named for the house; nothing stands alone at the column's foot
    # any more. The parent is no page, though, and no fold either: a door
    # in name only.
    Then the sidebar's foot is one parent named "olai"
    And the parent nests the Trash door
    When I pin the page
    Then the parent nests the vault group's "_olai/Pins.olai" row
    And there should be no page errors

  Scenario: The trash is out of the tree either way, because it is not a file you edit
    # The older ruling, and the group does not reach it: `_olai/Trash.olai`
    # is read on the Trash page and nowhere else, so it is not an outline the
    # group may offer even though it lives in the directory the group reads.
    # The pin is what puts a faceable file in `_olai/` at all.
    When I pin the page
    And I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "install"
    And the vault group links to "_olai/Pins.olai"
    But the vault group does not link to "_olai/Trash.olai"
    And the outline list does not link to "_olai/Trash.olai"

  Scenario: An outline that will not parse is marked in the group, not hidden
    # THE EXCEPTION, and the reason the group exists at all: the ⚠ is the
    # only way this app reports a file it could not read without somebody
    # opening the page to find out — so a `Pins.olai` that will not parse
    # must wear it WHERE the reader will see it, at the home these files
    # live in now (HACKING.md: never silently ignore errors).
    When I pin the page
    # The shelf FIRST, so the rewrite below lands on a file the pin has already
    # been written into rather than racing that write.
    Then the pinned shelf holds "/house.olai"
    And the vault group links to "_olai/Pins.olai"
    When I rewrite "_olai/Pins.olai" as:
      """
      {"id":"p0","ord":"a0",title:"/house.olai"}
      """
    Then the vault group's "_olai/Pins.olai" row is marked unreadable
    And the outline list does not link to "_olai/Pins.olai"

  Scenario: A file added under _olai/ joins the group as it lands
    # THE LIVE PROPERTY, and the whole reason the group reads the directory
    # rather than a LIST: a config the reader (or the watch setup) writes is
    # a row on the next publish — no preference, no rescan, no restart of
    # anything. And the wrench in the padi drawer can land on it because of
    # exactly this.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"watch","ord":"a0","title":"watch"}
      """
    Then the vault group links to "_olai/Kolu.olai"
    But the outline list does not link to "_olai/Kolu.olai"
    And there should be no page errors

  # ── the inbox mints under _olai/, and gets a door ────────────────────

  Scenario: A directory that has never captured offers no Inbox
    # Minting is the capture's job — ONE op, so a refused capture leaves no
    # file behind. A door offering to create one would be a second way to mint
    # the one file whose whole promise is that the write that fills it makes
    # it.
    Then the sidebar offers no Inbox
    And there should be no page errors

  Scenario: A capture mints _olai/Inbox.olai, and the Inbox entry opens it
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then "_olai/Inbox.olai" holds a node titled "buy the walnut stain"
    When I close the palette
    Then the sidebar offers the Inbox
    # Not also a tree row: it is a file olai named for itself. The vault
    # group keeps its door, since the group is the files' home now.
    And the outline list does not link to "_olai/Inbox.olai"
    And the vault group links to "_olai/Inbox.olai"
    When I open the Inbox from the sidebar
    Then the address is "/_olai/Inbox.olai"
    And the outline has 1 rows
    And there should be no page errors

  Scenario: An inbox that will not parse says so on its own door
    # THE DOOR'S OWN FENCE. The door is in two places at once — the entry
    # beside Agenda AND the vault group's row — and the ⚠ every unreadable
    # outline gets is on BOTH. Asserted on the door alone: the group row's
    # mark is the scenario above, and a step that read a row would stay
    # green with the door's mark dropped.
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    # The file FIRST, so the rewrite below lands on an inbox the capture has
    # already minted rather than racing that write.
    Then "_olai/Inbox.olai" holds a node titled "buy the walnut stain"
    When I close the palette
    And I rewrite "_olai/Inbox.olai" as:
      """
      {"id":"i0","ord":"a0",title:"buy the walnut stain"}
      """
    Then the Inbox door is marked unreadable
    And the Inbox wears no count

  Scenario: An inbox the directory already keeps is the file the capture and the door both use
    # ONLY THE MINT MOVED. A vault that already keeps `Inbox.olai` at its top
    # level goes on capturing into it — the finding rule is unchanged, by NAME,
    # shallowest first — and the entry is a door onto whichever file that is.
    # Its own file, so the tree draws it as well; the vault group may not take
    # a file the reader keeps at THEIR root.
    When I create the outline "Inbox.olai" from the sidebar
    And I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then "Inbox.olai" holds a node titled "buy the walnut stain"
    And "_olai/Inbox.olai" holds exactly 0 nodes titled "buy the walnut stain"
    When I close the palette
    Then the sidebar offers the Inbox
    And the outline list links to "Inbox.olai"
    But the vault group does not link to "Inbox.olai"
    When I open the Inbox from the sidebar
    Then the address is "/Inbox.olai"
    And there should be no page errors

  # ── the door sits by Agenda and wears its count ───────────────────────

  Scenario: The Inbox sits beside Agenda, not down with Trash
    # THE POSITION, as a scenario. The ruling moved the door up with the
    # primary destinations; a test that only asked "is there an Inbox" would
    # stay green with it still parked above Trash.
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
    # No chip at all rather than a nought: an inbox with nothing in it is a
    # door, not news — the same ruling Agenda's quiet face already keeps.
    When I create the outline "Inbox.olai" from the sidebar
    Then the sidebar offers the Inbox
    And the Inbox wears no count
    And there should be no page errors

  Scenario: A later root Inbox.olai is the file the door and the count both name
    # THE DIVERGENCE. A capture mints `_olai/Inbox.olai` and the door wears 1.
    # Creating `Inbox.olai` from the sidebar makes that the shallowest inbox —
    # the file capture and the door both use. The count has to follow them,
    # not stay on the deeper file that still holds the capture.
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    When I close the palette
    Then the Inbox wears a count of 1
    When I create the outline "Inbox.olai" from the sidebar
    Then the Inbox wears no count
    And the address is "/Inbox.olai"
    And there should be no page errors
