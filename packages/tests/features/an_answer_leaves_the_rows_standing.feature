@corpus:good
Feature: An answer leaves the rows it did not change standing
  The other half of `a_frame_leaves_it_standing.feature`, and the half a reader
  meets while TYPING: every search door mints its rows fresh from the answer, so
  a list drawn by reference was torn down and built again on each one — the ⌘K
  palette's hits, the header box's, the `@` rows in the chat composer, and the
  refusal lines under all three query doors.

  The first three are about a hand: the row a pointer is resting on, and the row
  a cursor is walking down, replaced under it. The rest are about an ear — a
  refusal is `role="alert"` and `aria-live="assertive"`, so a line rebuilt for
  the next keystroke is a sentence read out loud a second time to somebody who
  has not changed their mind (docs/brainstorming/reactivity-after-the-flip.md
  §3.2, findings 2.6 to 2.9). One scenario per door, because the three now draw
  ONE component (`client/SaidLine.tsx`) and the ear is the thing that
  swap could have cost.

  `@corpus:` rather than `@scratch:`: nothing here writes the directory. What
  moves is an answer.

  Background:
    Given I open the app

  Scenario: A letter taken back leaves the palette's rows standing
    Given I open the outline "house.olai"
    And I mark the page
    When I press the palette shortcut
    And I type "cabinets" into the palette
    Then the palette lists the node "order the new cabinets"
    And I mark every element of the "palette list"
    # One letter off WIDENS the answer: everything that was listed is still
    # listed, with one more beside it.
    When I type "cabinet" into the palette
    Then the palette lists the document "finishes.md"
    And the "palette list" kept every element it had
    And the page has not reloaded
    And there should be no page errors

  Scenario: A letter taken back leaves the header box's rows standing
    Given I open the outline "house.olai"
    And I mark the page
    When I search the header for "cabinets"
    Then the header search lists the node "order the new cabinets"
    And I mark every element of the "header search panel"
    When I take a letter off the header search
    Then the header search lists the document "finishes.md"
    And the "header search panel" kept every element it had
    And the page has not reloaded
    And there should be no page errors

  Scenario: The @ list's file rows hold still while the server's rows land beside them
    # This list is answered TWICE: the paths are matched in this tab and are up
    # at once, and the nodes are a debounce and a round trip behind. Drawn by
    # reference, the file rows a reader was already looking at were thrown away
    # and drawn again the moment the second half arrived.
    Given I mark the page
    And the agent panel is open
    When I type "read @fin" into the chat
    Then the name completion is open
    And the completion offers "finishes.md"
    And the completion does not offer "catch-up"
    And I mark every element of the "@ menu"
    Then the completion offers "catch-up"
    And the "@ menu" kept every element it had
    And the page has not reloaded
    And there should be no page errors

  Scenario: A refusal is not read out a second time for the next keystroke
    Given I open the outline "house.olai"
    And I mark the page
    When I filter the page by "is:nope"
    Then the filter refuses "is:nope" and says "done, doing, todo, marked, blocked, mirrored, trashed"
    And I mark every element of the "filter bar"
    # The same refusal, and a word beside it that the grammar CAN read. The line
    # does not change, so nothing about it may move.
    When I filter the page by "is:nope cabinets"
    Then the filter refuses "is:nope" and says "done, doing, todo, marked, blocked, mirrored, trashed"
    And the "filter bar" kept every element it had
    And nothing in the "filter bar" was announced again
    And the page has not reloaded
    And there should be no page errors

  # The same ear, at the two doors that had to ASK for the refusal. The bar
  # parses in this tab; these get their refusal back on an answer, and every
  # answer mints fresh `Refusal` objects — so what holds the line still is the
  # memo over the SENTENCES (`client/refusals.tsx`), which the swap onto one
  # markup had to leave standing. The row is marked rather than the whole panel
  # because a door's list is entitled to change while somebody types: what may
  # not is the live region beside it.
  #
  # A SECOND bad operator is what the next keystrokes add, and it is the wait
  # as much as the claim: a refused query selects nothing at every door
  # (`@olai/format`'s `filter.ts`), so a second refusal arriving is the only
  # sign the answer landed at all — and the line already up must not move for
  # it.
  Scenario: The palette's refusal is not read out a second time for the next keystroke
    Given I open the outline "house.olai"
    And I mark the page
    When I press the palette shortcut
    And I type "is:nope" into the palette
    Then the search refuses "is:nope" and says "done, doing, todo, marked, blocked, mirrored, trashed"
    And I mark every element of the "search refusal"
    When I type "is:nope date:tomorrowish" into the palette
    Then the search refuses 2 tokens
    And the search refuses "is:nope" and says "done, doing, todo, marked, blocked, mirrored, trashed"
    And the "search refusal" kept every element it had
    And nothing in the "search refusal" was announced again
    And the page has not reloaded
    And there should be no page errors

  Scenario: The header box's refusal is not read out a second time for the next keystroke
    Given I open the outline "house.olai"
    And I mark the page
    When I search the header for "is:nope"
    Then the search refuses "is:nope" and says "done, doing, todo, marked, blocked, mirrored, trashed"
    And I mark every element of the "search refusal"
    # Typed onto the end of what is already in the box, which is what a person
    # who has not changed their mind about `is:nope` does next.
    When I search the header for " date:tomorrowish"
    Then the search refuses 2 tokens
    And the search refuses "is:nope" and says "done, doing, todo, marked, blocked, mirrored, trashed"
    And the "search refusal" kept every element it had
    And nothing in the "search refusal" was announced again
    And the page has not reloaded
    And there should be no page errors
