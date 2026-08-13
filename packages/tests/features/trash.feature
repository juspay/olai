@scratch:good
Feature: The trash can be seen into, and taken out of
  `Archive.jsonl` used to be a file only an agent or an editor could look
  into, and nothing on any face could take a node back out of — the one
  entry in `editor-op-parity` that was an equal absence rather than a
  deviation. Now the web calls it the Trash: a sidebar entry of its own,
  read-only rows, and one verb — Put back — that sends the `unarchive` op
  both faces got together (`unarchive_node` is the same call).

  Every assertion that matters here is about the FILES afterwards, not the
  panel: a put-back is a claim about the outline on disk. `@scratch:`
  because these scenarios write the directory they are served.

  Background:
    Given I open the outline "house.jsonl"
    And I mark the page

  Scenario: The trash starts empty, and says so rather than erroring
    # No archive file exists in the fixture at all — the archive op creates
    # it on first use, so an absent archive IS an empty trash.
    When I open the Trash
    Then the Trash is empty

  Scenario: What is moved to the Trash is listed there, whole
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "Archive.jsonl" holds the node "install"
    When I open the Trash
    Then the Trash lists the node "install"
    And the Trash lists the node "handles"
    And the Trash lists the node "hinges"
    And the Trash lists the node "knobs"

  Scenario: The archive is the Trash's to show, not the sidebar's file tree
    # Before the trash view, the first archive quietly grew a new entry in the
    # outline list, editable like anything else. The entry now is the Trash.
    When I open the node menu of "knobs"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "Archive.jsonl" holds the node "knobs"
    And the outline list does not link to "Archive.jsonl"

  Scenario: Put back restores the subtree where it came from
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "house.jsonl" no longer holds the node "install"
    When I open the Trash
    And I put back "install" from the Trash
    Then "Archive.jsonl" no longer holds the node "install"
    And "house.jsonl" holds the node "install"
    # WHERE it landed is the half "holds" cannot pin: under its old parent,
    # found by the chain of ancestor titles the archive recorded — and the
    # children came back shaped as they left.
    And the node "install" in "house.jsonl" sits under "kitchen"
    And "house.jsonl" holds the node "handles"
    And the node "handles" in "house.jsonl" sits under "install"
    And the node "hinges" in "house.jsonl" sits under "install"
    # The emptied scaffold went with it: archive-then-unarchive leaves the
    # archive as it stood, which for this fixture is empty.
    And the Trash is empty
    And there should be no page errors

  Scenario: The signpost above a pile is not a row you can put back
    # The root row of a pile in the Trash is the TITLE the archive wrote to
    # remember where things hung — a copy of a node that never left. It is the
    # row a person reaching for "put this pile back" clicks first, so the
    # refusal has to be the ops layer's own sentence rather than a missing
    # button: it names the live node that still carries the title, and says to
    # put back what was put away.
    When I open the node menu of "knobs"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "Archive.jsonl" holds the node "knobs"
    When I open the Trash
    Then the Trash lists the node "knobs"
    # The signpost carries the live `install`'s title, and putting it back
    # would stand a second one beside it with `knobs` hanging off the copy.
    When I put back the row titled "install the cabinets" from the Trash
    Then the Trash says under the row titled "install the cabinets" that it is a signpost
    And "house.jsonl" holds one node titled "install the cabinets"
    And there should be no page errors

  Scenario: A chain that no longer stands is refused, and restoring it heals the way back
    # `knobs` goes in first, so its recorded chain ends at `install the
    # cabinets`; then `install` goes in too, and the chain matches nothing
    # live. The refusal is the ops layer's own sentence, verbatim, under the
    # row it was pressed on — and putting `install` back first re-erects the
    # chain, so the same press then lands.
    When I open the node menu of "knobs"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "Archive.jsonl" holds the node "knobs"
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "house.jsonl" no longer holds the node "install"
    When I open the Trash
    And I put back "knobs" from the Trash
    Then the Trash under "knobs" says "`pick the knobs` was archived from under `kitchen remodel #home` → `install the cabinets`, and that chain matches nothing in `garden.jsonl`, `house.jsonl` — it may have been retitled, or put away itself. Give `parent` (it goes under that node) or `file` (top level) to say where it goes back"
    And "Archive.jsonl" holds the node "knobs"
    When I put back "install" from the Trash
    Then the node "install" in "house.jsonl" sits under "kitchen"
    When I put back "knobs" from the Trash
    Then the node "knobs" in "house.jsonl" sits under "install"
    And the Trash is empty
    And there should be no page errors
