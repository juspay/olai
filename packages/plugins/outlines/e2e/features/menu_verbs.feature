@share-scratch
@scratch:good
Feature: The ••• menu writes
  The row menu used to offer five ways of looking at an outline and no way of
  changing one — while an agent at the same directory could mark a node todo,
  clear a date, retire a placement and archive a subtree. That gap is a
  consistency violation (MCP and Web ops must be consistent; never deviate)
  rather than a missing feature, and these are the verbs that close it for the
  mouse.

  Every one of them is ONE op through the same write gate the agent's tools go
  through, nothing is echoed, and what the ops layer refuses is quoted where
  the click happened rather than summarised. `@scratch:` because they write
  the directory they are served. They share one copy per worker
  (`@share-scratch`); the corpus is restored between scenarios.

  Background:
    Given I open the outline "house.olai"
    # These scenarios tick rows off and keep reading them, so finished work
    # must stay drawn: the per-page default is hidden now (preferences.feature).
    And I show the done nodes
    And I mark the page

  Scenario: A row with no mark is offered all four, and nothing to clear
    # The marks are one entry, `Mark ›`, and the four are in the submenu it
    # opens — in the order a task moves through, `Cancelled` last.
    When I open the node menu of "handles"
    And I open "Mark" in the node menu
    Then the node menu's "Mark" offers:
      | To do     |
      | Doing     |
      | Done      |
      | Cancelled |

  Scenario: A marked row is offered the other three, and the clear
    # `knobs` is todo: `To do` again is the one request the ops layer refuses
    # for asking about nothing, so it is not offered back.
    When I open the node menu of "knobs"
    And I open "Mark" in the node menu
    Then the node menu's "Mark" offers:
      | Doing     |
      | Done      |
      | Cancelled |
      | Clear     |

  Scenario: Marking a node writes the mark, and the page follows the file
    When I open the node menu of "handles"
    And I choose "Mark › Doing" from the node menu
    Then the node "handles" has status "doing"
    And "house.olai" holds a node marked doing titled "choose the handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Clearing a mark takes it off, and the entry goes with it
    When I open the node menu of "knobs"
    And I choose "Mark › Clear" from the node menu
    Then the node "knobs" has no status
    When I open the node menu of "knobs"
    Then the node menu does not offer "Mark › Clear"

  Scenario: Walking finished work backwards takes two clicks, and the ops layer says why
    # The refusal a person MUST see, in the ops layer's own words: nothing
    # decides on somebody's behalf that finished work is not finished. Two
    # calls is what an agent makes, so two clicks is what the menu asks for —
    # a menu that quietly sent both would be the web doing what MCP cannot.
    When I open the node menu of "demo"
    And I choose "Mark › Doing" from the node menu
    Then the node menu of "demo" says "`take out the old counters` is done. Undo that first — nothing should decide on your behalf that finished work is not finished."
    And the node "demo" has status "done"
    When I open the node menu of "demo"
    And I choose "Mark › Clear" from the node menu
    Then the node "demo" has no status
    When I open the node menu of "demo"
    And I choose "Mark › Doing" from the node menu
    Then the node "demo" has status "doing"

  Scenario: A write that landed with something to say says it here too
    # The rollup's nudge reaches the person who caused the write, exactly as it
    # reaches an agent that did — in the other mood, which is what `data-tone`
    # is for. `pick the hinges` is the last unfinished task under `install the
    # cabinets` once `pick the knobs` has stopped being one, so ticking it off
    # is the moment somebody might want to tick the branch.
    When I open the node menu of "knobs"
    And I choose "Mark › Clear" from the node menu
    Then the node "knobs" has no status
    When I open the node menu of "hinges"
    And I choose "Mark › Done" from the node menu
    Then the node "hinges" has status "done"
    And the node menu of "hinges" remarks "every task under `install the cabinets` is done now"

  Scenario: A mirror marks the node it shows
    # The same rule the checkbox and Ctrl+Enter follow: what a node SAYS is
    # edited on the node, wherever the reader is standing.
    When I open the node menu of "kitchen-herbs"
    And I choose "Mark › To do" from the node menu
    Then "garden.olai" holds a node marked todo titled "the herb bed by the door"

  Scenario: Clearing a date removes the field, and the badge with it
    # Taking a date back off is filed under `More ›`, away from `Change date…`.
    When I open the node menu of "order"
    And I choose "More › Clear date" from the node menu
    Then the node "order" shows no date
    And "house.olai" holds the node "order" with no date

  Scenario: Retiring a placement takes the line and leaves the node
    # What `outlines_unmirror` does, from the row it is about: the placement's own
    # record goes, the node it showed stays exactly where it lives.
    When I open the node menu of "kitchen-herbs"
    Then the node menu offers "More › Remove from here"
    And the node menu does not offer "Move to Trash"
    When I choose "More › Remove from here" from the node menu
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
    And I choose "More › Remove from here" from the node menu
    Then the node menu of "kitchen-herbs" says "`kitchen-herbs` is still named by `order` (`see`, house.olai:2) — retiring it would leave that pointing at nothing. Re-point it at `herbs` (the node this placement shows), or retire it first."
    And "house.olai" holds the node "kitchen-herbs"

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

  Scenario: Copy as text is the subtree, one tab per level
    # The indentation below is TABS — one per level, which is what every
    # outliner reads back as a level and what a paste-in parser will look for.
    Given this browser's clipboard records what is copied
    When I open the node menu of "install"
    And I choose "More › Copy as text" from the node menu
    Then the clipboard holds:
      """
      install the cabinets
      	[finishes](finishes.md)
      	choose the handles
      	pick the hinges
      	pick the knobs
      """

  Scenario: A note rides under its node, one level deeper
    Given this browser's clipboard records what is copied
    When I open the node menu of "order"
    And I choose "More › Copy as text" from the node menu
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
    And I choose "More › Copy as text" from the node menu
    Then the node menu of "kitchen" says "“Copy as text” didn’t work"

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
    And I choose "More › Copy link" from the node menu
    Then the node menu of "kitchen" remarks "Link copied"
