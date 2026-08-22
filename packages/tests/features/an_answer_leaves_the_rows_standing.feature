@corpus:good
Feature: An answer leaves the rows it did not change standing
  The other half of `a_frame_leaves_it_standing.feature`, and the half a reader
  meets while TYPING: every list in this app mints its rows fresh from the
  answer, so a list drawn by reference was torn down and built again on each one
  — the ⌘K palette's rows, the `@` rows in the chat composer, and the refusal
  line under the one search box.

  The first two are about a hand: the row a pointer is resting on, and the row a
  cursor is walking down, replaced under it. The rest are about an ear — a
  refusal is `role="alert"` and `aria-live="assertive"`, so a line rebuilt for
  the next keystroke is a sentence read out loud a second time to somebody who
  has not changed their mind (docs/brainstorming/reactivity-after-the-flip.md
  §3.2, findings 2.6 to 2.9).

  THE TWO SHORTLIST DOORS ARE GONE from this file with the doors themselves:
  the palette's node hits and the header's box were one reading drawn twice, and
  there is one search box now — the page's own
  (docs/brainstorming/one-search-box.md). What each of them was asserting about
  a HAND is asserted here about the palette's command rows and the composer's;
  what each was asserting about an EAR is asserted about the filter bar's own
  refusal, which is the line every one of those doors was drawing.

  `@corpus:` rather than `@scratch:`: nothing here writes the directory. What
  moves is an answer.

  Background:
    Given I open the app

  Scenario: A letter typed leaves the palette's rows standing
    # The palette's rows are matched in this tab off a list it already holds, so
    # a keystroke that changes which of them match must move exactly those rows
    # and leave the rest where the reader's cursor found them.
    Given I open the outline "house.olai"
    And I mark the page
    When I press the palette shortcut
    And I type "toggle" into the palette
    Then the palette offers "Toggle sidebar"
    And I mark every element of the "palette list"
    # One letter off WIDENS the answer: everything that was listed is still
    # listed, with the handoff row beside it.
    When I type "toggl" into the palette
    Then the palette offers "Toggle agent panel"
    And the "palette list" kept every element it had
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

  # The same ear, on the everywhere page — which is the same box over a
  # different scope, and the one place a second refused token is worth the wait
  # it takes: a refused query selects nothing at every door (`@olai/format`'s
  # `filter.ts`), so a second refusal arriving is the only sign anything landed
  # at all, and the line already up must not move for it. The ROW is marked
  # rather than the whole bar, because a count is entitled to change while
  # somebody types: what may not is the live region beside it.
  Scenario: The refusal on the everywhere page is not read out a second time either
    Given I search everywhere for "is:nope"
    And I mark the page
    Then the filter refuses "is:nope" and says "done, doing, todo, marked, blocked, mirrored, trashed"
    And I mark every element of the "search refusal"
    When I filter the page by "is:nope date:tomorrowish"
    Then the search refuses 2 tokens
    And the filter refuses "is:nope" and says "done, doing, todo, marked, blocked, mirrored, trashed"
    And the "search refusal" kept every element it had
    And nothing in the "search refusal" was announced again
    And the page has not reloaded
    And there should be no page errors
