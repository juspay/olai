@scratch:good
Feature: The files olai names for itself, and the doors onto them
  A served directory is somebody's — their outlines, at the top level where
  they put them. A file OLAI made because they pressed something goes under
  `_olai/`: the shelf, the trash, and now the inbox.

  Those files were being drawn TWICE. `_olai/` was an ordinary folder in the
  file tree, so `_olai/Pins.olai` sat there as a row even though the shelf
  above it already IS that file's face — and the trash has had a door of its
  own at the foot of the column since it was written. So the tree stops drawing
  them, and a **Prefs** switch draws them again for a reader who wants to open
  `Pins.olai` as an outline and read the addresses in it.

  It is a DRAWING rule and not a set rule, which is the line these scenarios
  keep: the files stay in the directory either way, and nothing here touches
  search, an agent's `list_outlines`, the trash page or the shelf.

  The INBOX moved under `_olai/` with them (human, 2026-08-20, reversing
  format.md's "deliberately NOT"), and it got the door that goes with being
  out of the tree. That door then moved UP beside Agenda (human, 2026-08-20,
  screenshot ruling) — a primary destination, not a foot-door with Trash —
  and it wears Agenda's own count badge: how many top-level captures the
  file holds, hidden at zero. Only the MINT moved as to WHICH file — a
  directory that already keeps its own `Inbox.olai` goes on capturing into
  the file it has, and this entry opens whichever file that is.

  `@scratch:` because these write the directory they are served.

  Background:
    Given I open the outline "house.olai"

  # ── the tree stops drawing them ──────────────────────────────────────

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

  # ── and the Prefs switch draws them again ────────────────────────────

  Scenario: Hidden outlines: Shown puts _olai/ back in the tree
    When I pin the page
    Then the outline list does not link to "_olai/Pins.olai"
    When I set Hidden outlines to "shown"
    Then the file tree shows the folder "_olai"
    When I expand the folder "_olai"
    Then the outline list links to "_olai/Pins.olai"
    And this browser has stored that hidden outlines are "shown"
    And the Hidden outlines row explains that the tree "draws _olai/ too"
    And there should be no page errors

  Scenario: The trash is out of the tree either way, because it is not a file you edit
    # The older ruling, and this switch does not reach it: `_olai/Trash.olai`
    # is read on the Trash page and nowhere else, so it is not an outline the
    # tree may open even for a reader who asked to see olai's own files. The
    # pin is what puts a drawable file in `_olai/` at all, so the folder the
    # trash is missing from is a folder that is there.
    When I pin the page
    And I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "install"
    When I set Hidden outlines to "shown"
    Then the file tree shows the folder "_olai"
    When I expand the folder "_olai"
    Then the outline list links to "_olai/Pins.olai"
    But the outline list does not link to "_olai/Trash.olai"

  Scenario: It is remembered, and it is this browser's
    When I pin the page
    And I set Hidden outlines to "shown"
    And I expand the folder "_olai"
    Then the outline list links to "_olai/Pins.olai"
    When I reload the page
    Then this browser has stored that hidden outlines are "shown"
    When I expand the folder "_olai"
    Then the outline list links to "_olai/Pins.olai"
    When I set Hidden outlines to "hidden"
    Then the outline list does not link to "_olai/Pins.olai"
    And the file tree does not show the folder "_olai"

  Scenario: An outline that will not parse keeps its row, hidden or not
    # THE EXCEPTION, and the reason the rule is asked with the broken files in
    # hand. The ⚠ on a row is the only place this app reports a file it could
    # not read without somebody opening the page to find out — so a hidden
    # `_olai/Pins.olai` that will not parse would be an empty shelf and no word
    # anywhere (HACKING.md: never silently ignore errors).
    When I pin the page
    # The shelf FIRST, so the rewrite below lands on a file the pin has already
    # been written into rather than racing that write.
    Then the pinned shelf holds "/house.olai"
    And the outline list does not link to "_olai/Pins.olai"
    When I rewrite "_olai/Pins.olai" as:
      """
      {"id":"p0","ord":"a0",title:"/house.olai"}
      """
    Then the file tree shows the folder "_olai"
    When I expand the folder "_olai"
    Then the outline "_olai/Pins.olai" is marked unreadable

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
    # Not also a tree row: it is a file olai named for itself.
    And the outline list does not link to "_olai/Inbox.olai"
    When I open the Inbox from the sidebar
    Then the address is "/_olai/Inbox.olai"
    And the outline has 1 rows
    And there should be no page errors

  Scenario: An inbox that will not parse says so on its own door
    # THE DOOR'S OWN FENCE. With the rule in force this entry is the only way
    # in to `_olai/Inbox.olai` — the tree does not draw it — so the ⚠ every
    # unreadable outline gets has to be ON the door. Asserted on the door
    # ALONE: the tree row keeping its mark is the scenario above, and a step
    # that read a row would stay green with the door's mark dropped.
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
    # Its own file, so the tree draws it as well: hiding a reader's own outline
    # is not this switch's business.
    When I create the outline "Inbox.olai" from the sidebar
    And I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then "Inbox.olai" holds a node titled "buy the walnut stain"
    And "_olai/Inbox.olai" holds exactly 0 nodes titled "buy the walnut stain"
    When I close the palette
    Then the sidebar offers the Inbox
    And the outline list links to "Inbox.olai"
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
