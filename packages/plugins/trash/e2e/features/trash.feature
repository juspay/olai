@share-scratch
@scratch:good
Feature: The trash can be seen into, taken out of, and emptied
  `_olai/Trash.olai` is the one trash: a sidebar entry of its own,
  read-only rows, and one verb — Put back — that sends the `untrash` op
  both faces share (`trash_restore` is the same call).

  The last block is the other end of it. A bin nothing could ever be emptied
  from is a bin that only fills up, so the page has one verb of its OWN:
  Empty trash, which permanently deletes every record in `_olai/Trash.olai`,
  behind a question naming how many rows go — counted over the SET — and saying
  outright that nothing in olai puts them back. It is the only destructive
  write in this app, `trash_empty` is the same op for an agent, and the
  scenarios below hold both halves of a confirm: the one that writes and the
  one that does not.

  Every assertion that matters here is about the FILES afterwards, not the
  panel: a put-back is a claim about the outline on disk, and so is an
  emptying. `@scratch:` because these scenarios write the directory they are
  served. They share one copy per worker (`@share-scratch`); the corpus is
  restored between scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: The Trash door is pinned at the sidebar's foot and opens the Trash
    Then the Trash door is pinned at the sidebar's foot
    When I open the Trash
    Then the Trash is empty
    And the Trash door is the current page
    And there should be no page errors

  Scenario: The collapsed rail keeps the Trash at its foot
    When I collapse the sidebar
    And I open the Trash from the rail
    Then the Trash is empty
    And there should be no page errors

  @phone
  Scenario: On a phone the Trash sits above the drawer's own foot, a finger's size
    When I tap the burger
    Then the Trash door is pinned at the sidebar's foot
    And the Trash door is at least a finger's size
    When I tap the Trash door
    Then the Trash is empty
    And there should be no page errors

  Scenario: The trash starts empty, and says so rather than erroring
    When I open the Trash
    Then the Trash is empty
    And the empty page says "Trash is empty" over "Deleted outlines and rows appear here."
    And the empty page "Trash is empty" offers nothing to press
    And there should be no page errors

  Scenario: What is moved to the Trash is listed there, whole
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "install"
    When I open the Trash
    Then the Trash lists the node "install"
    And the Trash lists the node "handles"
    And the Trash lists the node "hinges"
    And the Trash lists the node "knobs"

  Scenario: The archive is the Trash's to show, not the sidebar's file tree
    When I open the node menu of "knobs"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "knobs"
    And the outline list does not link to "_olai/Trash.olai"

  Scenario: Put back restores the subtree where it came from
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "house.olai" no longer holds the node "install"
    When I open the Trash
    And I put back "install" from the Trash
    Then "_olai/Trash.olai" no longer holds the node "install"
    And "house.olai" holds the node "install"
    And the node "install" in "house.olai" sits under "kitchen"
    And "house.olai" holds the node "handles"
    And the node "handles" in "house.olai" sits under "install"
    And the node "hinges" in "house.olai" sits under "install"
    And the Trash is empty
    And there should be no page errors

  Scenario: The signpost above a pile is not a row you can put back
    When I open the node menu of "knobs"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "knobs"
    When I open the Trash
    Then the Trash lists the node "knobs"
    When I put back the row titled "install the cabinets" from the Trash
    Then the Trash says under the row titled "install the cabinets" that it is a signpost
    And "house.olai" holds one node titled "install the cabinets"
    And there should be no page errors

  Scenario: A chain that no longer stands is refused, and restoring it heals the way back
    When I open the node menu of "knobs"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "knobs"
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "house.olai" no longer holds the node "install"
    When I open the Trash
    And I put back "knobs" from the Trash
    Then the Trash under "knobs" says "`pick the knobs` was put away from under `kitchen remodel #home` → `install the cabinets` in `house.olai`, and that chain matches nothing there — it may have been retitled, or put away itself. Give `parent` (it goes under that node) or `file` (top level) to say where it goes back"
    And "_olai/Trash.olai" holds the node "knobs"
    When I put back "install" from the Trash
    Then the node "install" in "house.olai" sits under "kitchen"
    When I put back "knobs" from the Trash
    Then the node "knobs" in "house.olai" sits under "install"
    And the Trash is empty
    And there should be no page errors

  Scenario: An empty Trash offers nothing to empty
    When I open the Trash
    Then the Trash is empty
    And the Trash does not offer Empty trash

  Scenario: Cancel writes nothing, and leaves the Trash exactly as it stood
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    When I open the Trash
    And I press Empty trash
    And I cancel emptying the Trash
    Then the Trash lists the node "install"
    And the Trash lists the node "knobs"
    And "_olai/Trash.olai" holds the node "install"
    And the Trash offers Empty trash
    And there should be no page errors

  Scenario: Confirming empties it for good, and the archive on disk holds nothing
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "house.olai" no longer holds the node "install"
    When I open the Trash
    And I press Empty trash
    And I confirm emptying the Trash
    Then "_olai/Trash.olai" holds nothing
    And the Trash is empty
    And the Trash does not offer Empty trash
    And "house.olai" holds the node "kitchen"
    And there should be no page errors

  Scenario: A live row still pointing into the Trash refuses it, in the ops layer's own words
    When I open the node menu of "order"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "order"
    When I open the Trash
    And I press Empty trash
    And I confirm emptying the Trash
    Then the Trash says "`_olai/Trash.olai` still has records pointed INTO it from outside: `install` (`after`, house.olai:3), `hinges` (`after`, house.olai:5). Deleting what those name would leave them pointing at nothing, so nothing was written — re-point or retire them first, or `trash_restore` what they name back out."
    And "_olai/Trash.olai" holds the node "order"
    And there should be no page errors

  Scenario: Two piles are one emptying, and an edge BETWEEN them is not a holder
    When I open the outline "Daily/2026-08.olai"
    And I open the node menu of "catch-up"
    And I choose "More › Link to…" from the node menu
    Then the see panel is open on "catch-up"
    When I search the edge panel for "knobs"
    And I choose "pick the knobs" from the edge panel
    Then "Daily/2026-08.olai" holds the node "catch-up" seeing "knobs"
    When I open the node menu of "catch-up"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "catch-up"
    When I open the outline "house.olai"
    And I open the node menu of "knobs"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "knobs"
    When I open the Trash
    And I press Empty trash
    Then the Trash asks "Permanently delete all 7 rows in Trash? olai can't bring them back. Only what git has already saved can be recovered."
    When I confirm emptying the Trash
    Then "_olai/Trash.olai" holds nothing
    And the Trash is empty
    And there should be no page errors
