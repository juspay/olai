@scratch:good
Feature: The ••• menu writes
  The row menu used to offer five ways of looking at an outline and no way of
  changing one — while an agent at the same directory could mark a node todo,
  clear a date, retire a placement and archive a subtree. That gap is a
  HACKING.md consistency violation rather than a missing feature, and these
  are the verbs that close it for the mouse.
      | Move to…           |

  Every one of them is ONE op through the same write gate the agent's tools go
  through, nothing is echoed, and what the ops layer refuses is quoted where
  the click happened rather than summarised. `@scratch:` because they write
  the directory they are served — each scenario gets a private copy of it.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: The menu offers what this row can take, and nothing that would be a no-op
    # `kitchen` is doing, has children, has no date and is a node rather than a
    # placement — so: no `Mark doing` (it carries one, and the row's own
    # checkbox is what says which), no `Clear date`, no `Remove this
    # placement`. The date entry is `Set date…` rather than `Change date…` for
    # the same reason, and its ellipsis says it opens the picker rather than
    # writing (`setting_a_date.feature`). A rule between the two halves:
    # everything above the divider changes what this tab is looking at,
    # everything below it changes the directory.
    #
    # `Add property…` is here and no `Edit`/`Remove` pair is, for the same
    # reason as the marks: the row carries no custom property, so there is
    # nothing to offer to change (`properties.feature`).
    #
    # The two EDGE verbs are the exception that proves the rule, and it is a
    # deliberate one: every node can take a `see` or an `after`, so there is
    # nothing about this row to leave them out for — and what WOULD be refused
    # (a loop) is the ops layer's sentence to say when it is asked for, not a
    # missing entry (`edge_editing.feature`).
    #
    # `Duplicate` is here for the edge verbs' reason read once more — every node
    # can be copied, so there is nothing about this row to leave it out for —
    # and it sits ABOVE `Move to Trash` because the additive verb should not be
    # next to the one with reach (`duplicate_subtree.feature`).
    #
    # `Move to…` is the edge verbs' case a third time and one step further:
    # every row can be carried somewhere, a PLACEMENT included, so it is the one
    # write here offered on both kinds of row — and which destinations it will
    # not take is the picker's own sentence at the aim rather than a missing
    # entry (`move_to_picker.feature`).
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen"
    Then the node menu offers exactly:
      | Zoom in            |
      | Ask agent          |
      | Collapse           |
      | Expand all         |
      | Collapse all       |
      | Copy link to node  |
      | Pin to sidebar     |
      | Mark todo          |
      | Complete           |
      | Clear mark         |
      | Set date…          |
      | Add property…      |
      | Link to a node…    |
      | Wait for a node…   |
      | Move to…           |
      | Duplicate          |
      | Move to Trash      |
      | Copy as text       |

  Scenario: A row with no mark is offered all three, and nothing to clear
    When I open the node menu of "handles"
    Then the node menu offers "Mark todo"
    And the node menu offers "Mark doing"
    And the node menu offers "Complete"
    And the node menu does not offer "Clear mark"

  Scenario: Marking a node writes the mark, and the page follows the file
    When I open the node menu of "handles"
    And I choose "Mark doing" from the node menu
    Then the node "handles" has status "doing"
    And "house.olai" holds a node marked doing titled "choose the handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Clearing a mark takes it off, and the entry goes with it
    When I open the node menu of "knobs"
    And I choose "Clear mark" from the node menu
    Then the node "knobs" has no status
    When I open the node menu of "knobs"
    Then the node menu does not offer "Clear mark"

  Scenario: Walking finished work backwards takes two clicks, and the ops layer says why
    # The refusal a person MUST see, in the ops layer's own words: nothing
    # decides on somebody's behalf that finished work is not finished. Two
    # calls is what an agent makes, so two clicks is what the menu asks for —
    # a menu that quietly sent both would be the web doing what MCP cannot.
    When I open the node menu of "demo"
    And I choose "Mark doing" from the node menu
    Then the node menu of "demo" says "`take out the old counters` is done. Undo that first — nothing should decide on your behalf that finished work is not finished."
    And the node "demo" has status "done"
    When I open the node menu of "demo"
    And I choose "Clear mark" from the node menu
    Then the node "demo" has no status
    When I open the node menu of "demo"
    And I choose "Mark doing" from the node menu
    Then the node "demo" has status "doing"

  Scenario: The menu will not start what the order forbids either
    # HACKING.md's parity rule, on the refusal this PR adds: the mouse meets the
    # ops layer's sentence exactly as the keyboard and an agent do, because
    # there is one gate and the menu sends one op through it. `install` is a
    # bullet — nothing is drawing it blocked, because a bullet is not work — and
    # `Mark doing` is about to MAKE it work, so its `after` edge is asked about
    # here rather than after the write.
    When I open the node menu of "install"
    And I choose "Mark doing" from the node menu
    Then the node menu of "install" says "`install the cabinets` comes after 1 unfinished task, so it cannot start yet: `order the new cabinets` (`order`, doing). Finish that first — or start what is ready."
    And the node "install" has no status
    # And filing work is not starting it, so `Mark todo` goes through.
    When I open the node menu of "install"
    And I choose "Mark todo" from the node menu
    Then the node "install" has status "todo"

  Scenario: The menu will not tick off a branch that holds unfinished work either
    # The other gate, at the same door (`done-over-open-work`, 2026-08-16):
    # done-hiding takes the subtree with the row, so `Complete` here would sweep
    # two `todo` children off the page. Refused in the ops layer's own words,
    # which is the whole of HACKING.md's parity rule — one gate, three faces.
    When I open the node menu of "install"
    And I choose "Complete" from the node menu
    Then the node menu of "install" says "`install the cabinets` holds 2 unfinished tasks, so it cannot be marked done yet: `pick the hinges` (`hinges`, todo), `pick the knobs` (`knobs`, todo). Done-hidden hides a done node WITH its subtree, so this would sweep them off the page. Finish those first — or take the mark off them if they are not happening, since an unmarked bullet is not unfinished work."
    And the node "install" has no status

  Scenario: A write that landed with something to say says it here too
    # The rollup's nudge reaches the person who caused the write, exactly as it
    # reaches an agent that did — in the other mood, which is what `data-tone`
    # is for. `pick the hinges` is the last unfinished task under `install the
    # cabinets` once `pick the knobs` has stopped being one, so ticking it off
    # is the moment somebody might want to tick the branch.
    When I open the node menu of "knobs"
    And I choose "Clear mark" from the node menu
    Then the node "knobs" has no status
    When I open the node menu of "hinges"
    And I choose "Complete" from the node menu
    Then the node "hinges" has status "done"
    And the node menu of "hinges" remarks "every task under `install the cabinets` is done now"

  Scenario: A mirror marks the node it shows
    # The same rule the checkbox and Ctrl+Enter follow: what a node SAYS is
    # edited on the node, wherever the reader is standing.
    When I open the node menu of "kitchen-herbs"
    And I choose "Mark todo" from the node menu
    Then "garden.olai" holds a node marked todo titled "the herb bed by the door"

  Scenario: Only a dated row offers to clear a date
    When I open the node menu of "install"
    Then the node menu does not offer "Clear date"

  Scenario: Clearing a date removes the field, and the badge with it
    When I open the node menu of "order"
    And I choose "Clear date" from the node menu
    Then the node "order" shows no date
    And "house.olai" holds the node "order" with no date

  Scenario: Retiring a placement takes the line and leaves the node
    # What `remove_mirror` does, from the row it is about: the placement's own
    # record goes, the node it showed stays exactly where it lives.
    When I open the node menu of "kitchen-herbs"
    Then the node menu offers "Remove this placement"
    And the node menu does not offer "Move to Trash"
    When I choose "Remove this placement" from the node menu
    Then "house.olai" no longer holds the node "kitchen-herbs"
    And "garden.olai" holds the node "herbs"
    And the node "kitchen-herbs" is not shown

  Scenario: A placement something else still names is refused, naming what
    # The op's own fence, quoted: retiring this line would leave the `see` on
    # `order` pointing at nothing. Written by another hand while the page is
    # open, which is also how the refusal gets to be about the set as it IS.
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","see":["kitchen-herbs"]}
      {"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}
      """
    # The other hand's write has to have ARRIVED before the menu is opened on
    # a row it redrew: `install` is gone from the file above, so its row going
    # is the frame this scenario is waiting for. Without it the pointer opens a
    # menu on an element the next frame replaces, and the panel never appears.
    Then the node "install" is not shown
    When I open the node menu of "kitchen-herbs"
    And I choose "Remove this placement" from the node menu
    Then the node menu of "kitchen-herbs" says "`kitchen-herbs` is still named by `order` (`see`, house.olai:2) — retiring it would leave that pointing at nothing. Re-point it at `herbs` (the node this placement shows), or retire it first."
    And "house.olai" holds the node "kitchen-herbs"

  Scenario: Moving to the Trash asks first, and names how much goes with it
    # The human's ruling: a subtree may be archived, WITH a confirm naming the
    # blast radius — and the confirm is this panel's own second step, not a
    # browser dialog, which is chrome olai does not own. It also names the way
    # back, because the Trash has one now: the sidebar entry, and Put back.
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    Then the node menu asks "Move “install the cabinets” and the 3 rows under it to the Trash? They keep their ids, and the Trash in the sidebar is where to put them back."
    And "house.olai" holds a node titled "install the cabinets"

  Scenario: The confirm counts what the write moves, not what is on screen
    # The rows a page draws are a READING: hiding what is done drops finished
    # branches from them (`withoutDone`), and `demo` is one. The count is asked
    # of the SET instead, because what a person is agreeing to is how much
    # `archive` moves — so this says seven while six rows are drawn. A count
    # taken from the children would say six and archive seven, which is the one
    # verb whose reach exceeds its row mis-stating its reach.
    Given the node "kitchen" is expanded
    When I hide the done nodes
    Then the node "demo" is not shown
    When I open the node menu of "kitchen"
    And I choose "Move to Trash" from the node menu
    Then the node menu asks "Move “kitchen remodel #home” and the 7 rows under it to the Trash? They keep their ids, and the Trash in the sidebar is where to put them back."

  Scenario: Cancelling the confirm writes nothing
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Cancel" from the node menu
    Then the node menu is not asking anything
    And the node menu offers "Move to Trash"
    And "house.olai" holds a node titled "install the cabinets"

  Scenario: Confirming moves the subtree to the Trash, ids and all
    # A trash rather than a shredder: the ids come along, so the `after` edges
    # and mirrors that name them go on resolving — which is the whole reason
    # this is `archive` underneath and not a delete.
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "house.olai" no longer holds the node "install"
    And "_olai/Trash.olai" holds the node "install"
    And "_olai/Trash.olai" holds the node "hinges"
    And "_olai/Trash.olai" holds a node titled "install the cabinets"
    And the node "install" is not shown
    And there should be no page errors

  Scenario: A childless row is asked about on its own
    When I open the node menu of "knobs"
    And I choose "Move to Trash" from the node menu
    Then the node menu asks "Move “pick the knobs” to the Trash? It keeps its id, and the Trash in the sidebar is where to put it back."

  Scenario: Copy as text is the subtree, one tab per level
    # The indentation below is TABS — one per level, which is what every
    # outliner reads back as a level and what a paste-in parser will look for.
    Given this browser's clipboard records what is copied
    When I open the node menu of "install"
    And I choose "Copy as text" from the node menu
    Then the clipboard holds:
      """
      install the cabinets
      	choose the handles
      	pick the hinges
      	pick the knobs
      """

  Scenario: A note rides under its node, one level deeper
    Given this browser's clipboard records what is copied
    When I open the node menu of "order"
    And I choose "Copy as text" from the node menu
    Then the clipboard holds:
      """
      order the new cabinets
      	Two ways to go:

      	- **walnut** — six week lead time
      	- *birch* — in stock today

      	Measure the alcove before ordering.
      """

  Scenario: A copy the browser refused says so, instead of nothing
    Given this browser's clipboard refuses
    When I open the node menu of "kitchen"
    And I choose "Copy as text" from the node menu
    Then the node menu of "kitchen" says "couldn't copy as text"

  Scenario: A copy that LANDED says so too
    # The other half of the scenario above, and the reason it is worth a
    # scenario of its own: the clipboard is the one destination outside this
    # app, so a copy that worked and a copy that never happened draw exactly
    # the same outline. Saying only when it FAILS leaves the ordinary case
    # indistinguishable from a click that missed the entry — the menu shuts
    # either way. The `aside` tone is asserted by the step, which is what keeps
    # a remark from arriving dressed as a refusal.
    Given this browser's clipboard records what is copied
    When I open the node menu of "kitchen"
    And I choose "Copy link to node" from the node menu
    Then the node menu of "kitchen" remarks "link copied"

  Scenario: ...and so does the other copy, in the same words
    # Two clipboard verbs, one sentence shape (`actions.ts`'s `copied`): a
    # second one that stayed silent would be the inconsistency the first was
    # fixed for.
    Given this browser's clipboard records what is copied
    When I open the node menu of "install"
    And I choose "Copy as text" from the node menu
    Then the node menu of "install" remarks "text copied"
