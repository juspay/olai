@share-scratch
@scratch:good
Feature: Setting a date from the web
  An agent could set OR clear a node's `date` (`set_date`) and a person could
  only clear one (#124's `•••` verb) — a HACKING.md consistency deviation
  rather than a missing feature. The picker closes it, and it is reached from
  the two places a date already is: the pill on the row, and the row's menu.

  What it sends is one `date` edit at the same write gate the keys and the
  agent's tools go through, so nothing is echoed — the badge changes when the
  file says it changed. And the day it writes is TEXT: the ten characters that
  were picked, verbatim, never a value that has been through an instant.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: The pill on a dated row is the way in, and it starts on that day
    When I open the date picker on "order"
    Then the date picker holds "2026-08-10"
    And the date picker offers to "Set date"

  Scenario: Picking a day writes exactly those ten characters
    # The format's own rule at this seam: a date is text, stored verbatim, so
    # what the record holds is what was picked — never a datetime that came
    # back from a parse.
    When I open the date picker on "order"
    And I pick the date "2026-09-01"
    Then the node "order" shows the date "2026-09-01"
    And "house.olai" holds the node "order" dated "2026-09-01"
    And the date picker is closed
    And the page has not reloaded
    And there should be no page errors

  Scenario: An undated row is offered the picker from its menu
    When I open the node menu of "install"
    Then the node menu offers "Set date…"
    And the node menu does not offer "Change date…"
    When I choose "Set date…" from the node menu
    Then the date picker is open
    And the date picker holds ""
    # ...and the menu says NOTHING. An entry answers with what it has to say,
    # and opening a picker has nothing — this shipped as an empty bordered box
    # under the `•••` once, because a Solid setter answers with the new value
    # and `() => void` accepts any return.
    And the node menu of "install" says nothing
    When I pick the date "2026-09-01"
    Then the node "install" shows the date "2026-09-01"
    And "house.olai" holds the node "install" dated "2026-09-01"
    And there should be no page errors

  Scenario: A dated row's menu says which of the two it is, and still clears
    # Both halves of `set_date` are a person's now, and the entry is named for
    # what the row carries. Clearing keeps the verb #124 gave it, unchanged.
    When I open the node menu of "order"
    Then the node menu offers "Change date…"
    And the node menu offers "Clear date"
    And the node menu does not offer "Set date…"

  Scenario: An emptied box is the menu's own Clear date, and it clears
    # The picker ABSORBS the gesture rather than adding a second spelling of
    # it: the button takes the menu's label and sends the menu's edit. The
    # alternative was a button that went dead the moment somebody emptied the
    # box, in the one place they are most likely to be reaching for exactly
    # that.
    When I open the date picker on "order"
    And I empty the date picker
    Then the date picker offers to "Clear date"
    When I press the date picker's button
    Then the node "order" shows no date
    And "house.olai" holds the node "order" with no date
    And there should be no page errors

  Scenario: Nothing to write is nothing to press
    # The same rule the menu's own catalog follows: an entry whose only
    # possible outcome is "it already says that" is not offered.
    When I open the date picker on "order"
    Then the date picker's button is dead
    # And an empty box over a node with no date is the same answer: there is
    # no date to take off. One picker at a time in this scenario, because the
    # steps below name the one that is open.
    When I press "Escape"
    And I open the node menu of "install"
    And I choose "Set date…" from the node menu
    Then the date picker's button is dead
    # And what the dead button SAYS is the verb they came for. `Clear date`
    # here would be an offer to take away something that is not there — which
    # is what it read before the label and the deadness became one answer, and
    # a scenario that only asked about deadness would have kept that green.
    And the date picker offers to "Set date"

  Scenario: A node scheduled for an INSTANT starts on its day, and says so
    # The format lets `date` carry a datetime, and a day box can only hold a
    # day — so it holds the day that instant falls on (`@olai/format`'s own
    # first-ten-characters reading) and the panel says what picking one would
    # do to the rest. Written by another hand, which is also how a set arrives
    # from a `git pull`.
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05","date":"2026-08-10T14:30:00-04:00"}
      """
    Then the node "install" is not shown
    When I open the date picker on "order"
    Then the date picker holds "2026-08-10"
    And the date picker says "Scheduled for 2026-08-10T14:30:00-04:00. Picking a day writes that day, and the time goes with it."
    When I pick the date "2026-08-10"
    Then "house.olai" holds the node "order" dated "2026-08-10"

  Scenario: A date set here moves the node onto that day's page
    # `knobs` carries no date, so the menu is its door — there is no pill to
    # press until this write puts one there.
    When I open the node menu of "knobs"
    And I choose "Set date…" from the node menu
    And I pick the date "2026-09-01"
    When I open the day "2026-09-01"
    Then the node "knobs" is shown
    And there should be no page errors

  Scenario: A past date on a task puts it above now on the line, without a reload
    # The agenda is the consumer, and it is a QUERY over the same dates: a
    # `todo` given a day that has gone is late by construction, and the page
    # that collects it is one SPA navigation away from the row it was set on.
    # `knobs` is the new one, dated 2019; `order` was already late and is dated
    # 2026 — and the line runs oldest first, so the new one goes above it.
    When I open the node menu of "knobs"
    And I choose "Set date…" from the node menu
    And I pick the date "2019-11-05"
    Then the node "knobs" shows the date "2019-11-05"
    When I follow the agenda link
    Then the spine's "late" rows are "knobs, order"
    And the date on "knobs" is overdue
    And the page has not reloaded
    And there should be no page errors

  Scenario: ⌘Z takes a picked date back, on the stack a keystroke files on
    # A pointer's write files what would undo it on the same stack a keystroke
    # files on — so the chord does not mean two things depending on which hand
    # made the edit.
    When I open the date picker on "order"
    And I pick the date "2026-09-01"
    Then "house.olai" holds the node "order" dated "2026-09-01"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds the node "order" dated "2026-08-10"
    And the node "order" shows the date "2026-08-10"

  Scenario: The pill on a day page is not a control
    # The same split a title's editability follows: a day page and the agenda
    # are a query over the whole set, drawn read-only, so the badge there says
    # something rather than doing something.
    When I open the day "2026-08-10"
    Then the date on "order" does not open the picker
