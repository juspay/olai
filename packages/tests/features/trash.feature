@scratch:good
Feature: The trash can be seen into, taken out of, and emptied
  `_olai/Trash.olai` is the one trash: a sidebar entry of its own,
  read-only rows, and one verb — Put back — that sends the `untrash` op
  both faces share (`untrash_node` is the same call).

  The last block is the other end of it. A bin nothing could ever be emptied
  from is a bin that only fills up, so the page has one verb of its OWN:
  Empty trash, which permanently deletes every record in `_olai/Trash.olai`,
  behind a question naming how many rows go — counted over the SET — and saying
  outright that nothing in olai puts them back. It is the only destructive
  write in this app, `empty_trash` is the same op for an agent, and the
  scenarios below hold both halves of a confirm: the one that writes and the
  one that does not.

  Every assertion that matters here is about the FILES afterwards, not the
  panel: a put-back is a claim about the outline on disk, and so is an
  emptying. `@scratch:` because these scenarios write the directory they are
  served.

  Background:
    Given I open the outline "house.olai"
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
    Then "_olai/Trash.olai" holds the node "install"
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
    # WHERE it landed is the half "holds" cannot pin: under its old parent,
    # found by the chain of ancestor titles the archive recorded — and the
    # children came back shaped as they left.
    And the node "install" in "house.olai" sits under "kitchen"
    And "house.olai" holds the node "handles"
    And the node "handles" in "house.olai" sits under "install"
    And the node "hinges" in "house.olai" sits under "install"
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
    Then "_olai/Trash.olai" holds the node "knobs"
    When I open the Trash
    Then the Trash lists the node "knobs"
    # The signpost carries the live `install`'s title, and putting it back
    # would stand a second one beside it with `knobs` hanging off the copy.
    When I put back the row titled "install the cabinets" from the Trash
    Then the Trash says under the row titled "install the cabinets" that it is a signpost
    And "house.olai" holds one node titled "install the cabinets"
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
    # A control that would delete nothing teaches a reader the wrong thing
    # about the one control here that cannot be taken back — so it is not
    # drawn at all until there is a pile.
    When I open the Trash
    Then the Trash is empty
    And the Trash does not offer Empty trash

  Scenario: Emptying asks first, and the question names how many rows go
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "install"
    When I open the Trash
    Then the Trash offers Empty trash
    # Six: the subtree's four rows, plus the source-file signpost and the
    # ancestor title the trash wrote above them to remember where they hung.
    # Every one of them is a record the write deletes, and a row a reader can
    # see on this page.
    When I press Empty trash
    Then the Trash asks "Permanently delete all 6 rows in the Trash? Nothing in olai puts them back — the records leave the trash the way every other write does, so what survives is whatever git has already recorded."

  Scenario: The count is the SET's, not the rows a filter left on screen
    # The lesson `parity-archive`'s own confirm learned: what a person agrees
    # to has to be what the write moves. Narrowing this page to one row must
    # not narrow the sentence — the pile still goes, whole.
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    When I open the Trash
    And I filter the page by "knobs"
    Then the Trash lists the node "knobs"
    And the Trash does not list the node "hinges"
    When I press Empty trash
    Then the Trash asks "Permanently delete all 6 rows in the Trash? Nothing in olai puts them back — the records leave the trash the way every other write does, so what survives is whatever git has already recorded."

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
    # The blast radius is the archive and nothing else: the live outline the
    # subtree came out of is untouched by the delete.
    And "house.olai" holds the node "kitchen"
    And there should be no page errors

  Scenario: A live row still pointing into the Trash refuses it, in the ops layer's own words
    # Ids move with a node when it is archived — that is what makes a mirror or
    # an `after` naming what you put away go on resolving — so deleting those
    # records would leave live rows naming ids nothing declares. `install` and
    # `hinges` both wait on `order`, and the refusal names them rather than
    # letting the write gate answer with the validator's rows.
    When I open the node menu of "order"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "order"
    When I open the Trash
    And I press Empty trash
    And I confirm emptying the Trash
    Then the Trash says "`_olai/Trash.olai` still has records pointed INTO it from outside: `install` (`after`, house.olai:3), `hinges` (`after`, house.olai:5). Deleting what those name would leave them pointing at nothing, so nothing was written — re-point or retire them first, or `untrash_node` what they name back out."
    And "_olai/Trash.olai" holds the node "order"
    And there should be no page errors

  Scenario: Two piles are one emptying, and an edge BETWEEN them is not a holder
    # Grok's objection on #250, driven from the button. `catch-up` lives in
    # `Daily/2026-08.olai` and `knobs` in `house.olai` — two piles in the ONE
    # trash, and a `see` written from one to the other before either is put away.
    #
    # The edge is a record THIS WRITE DELETES, so it is not a reason to refuse.
    # It used to be one: the button sent an `apply` of one `empty` per archive,
    # each judged against one pile. One op naming the union is what fixed it,
    # and one trash file is why the two piles are already one emptying.
    When I open the outline "Daily/2026-08.olai"
    And I open the node menu of "catch-up"
    And I choose "Link to a node…" from the node menu
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
    # Seven: source-file signposts for both piles, the ancestor titles above
    # each (`kitchen remodel #home` → `install the cabinets` for knobs,
    # `August 2026` for catch-up), and the two rows themselves.
    And I press Empty trash
    Then the Trash asks "Permanently delete all 7 rows in the Trash? Nothing in olai puts them back — the records leave the trash the way every other write does, so what survives is whatever git has already recorded."
    When I confirm emptying the Trash
    Then "_olai/Trash.olai" holds nothing
    And the Trash is empty
    And there should be no page errors
