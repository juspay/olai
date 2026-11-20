@share-scratch
@scratch:good
Feature: Setting a date from the web
  An agent could set OR clear a node's `date` (`outlines_date`) and a person could
  only clear one (#124's `•••` verb) — a consistency deviation
  rather than a missing feature. The picker closes it, and it is reached from
  the two places a date already is: the pill on the row, and the row's menu.

  What it sends is one `date` edit at the same write gate the keys and the
  agent's tools go through, so nothing is echoed — the badge changes when the
  file says it changed. And the day it writes is TEXT: the ten characters that
  were picked, verbatim, never a value that has been through an instant. A time
  of day is optional beside it, and is written the way a mark stamps one.

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
    And the node menu of "install" says nothing
    When I pick the date "2026-09-01"
    Then the node "install" shows the date "2026-09-01"
    And "house.olai" holds the node "install" dated "2026-09-01"
    And there should be no page errors

  Scenario: A dated row's menu says which of the two it is, and still clears
    When I open the node menu of "order"
    Then the node menu offers "Change date…"
    And the node menu offers "More › Clear date"
    And the node menu does not offer "Set date…"

  Scenario: An emptied box is the menu's own Clear date, and it clears
    When I open the date picker on "order"
    And I empty the date picker
    Then the date picker offers to "Clear date"
    When I press the date picker's button
    Then the node "order" shows no date
    And "house.olai" holds the node "order" with no date
    And there should be no page errors

  Scenario: Nothing to write is nothing to press
    When I open the date picker on "order"
    Then the date picker's button is dead
    When I press "Escape"
    And I open the node menu of "install"
    And I choose "Set date…" from the node menu
    Then the date picker's button is dead
    And the date picker offers to "Set date"

  @zone:America/New_York
  Scenario: A day and a time write one instant, in the offset of that moment
    When I open the date picker on "order"
    Then the date picker holds "2026-08-10" at ""
    When I pick the date "2026-09-01" at "09:30"
    Then "house.olai" holds the node "order" dated "2026-09-01T09:30:00-04:00"
    And the node "order" shows the date "2026-09-01"
    And the date picker is closed
    When I open the date picker on "order"
    Then the date picker holds "2026-09-01" at "09:30"
    And the date picker's button is dead
    When I pick the date "2026-12-01" at "09:30"
    Then "house.olai" holds the node "order" dated "2026-12-01T09:30:00-05:00"
    And the page has not reloaded
    And there should be no page errors

  @zone:America/New_York
  Scenario: A timed node opens on its day and time, and a changed time is written
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05","date":"2026-08-10T14:30:44-04:00"}
      """
    Then the node "install" is not shown
    When I open the date picker on "order"
    Then the date picker holds "2026-08-10" at "14:30"
    And the date picker says nothing
    And the date picker's button is dead
    When I draft the time "16:05"
    Then the date picker offers to "Set date"
    When I press the date picker's button
    Then "house.olai" holds the node "order" dated "2026-08-10T16:05:00-04:00"
    And the date picker is closed
    And there should be no page errors

  @zone:America/New_York
  Scenario: Taking the time off keeps the day, and ⌘Z puts the time back
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05","date":"2026-08-10T14:30:44-04:00"}
      """
    Then the node "install" is not shown
    When I open the date picker on "order"
    And I take the time off in the date picker
    Then the date picker holds "2026-08-10" at ""
    And the date picker offers to "Clear time"
    When I press the date picker's button
    Then "house.olai" holds the node "order" dated "2026-08-10"
    And the date picker is closed
    When I press "ControlOrMeta+z"
    Then "house.olai" holds the node "order" dated "2026-08-10T14:30:44-04:00"
    And there should be no page errors

  Scenario: Emptying the day clears a timed date whole
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05","date":"2026-08-10T14:30:00-04:00"}
      """
    Then the node "install" is not shown
    When I open the date picker on "order"
    And I empty the date picker
    Then the date picker holds "" at "14:30"
    And the date picker offers to "Clear date"
    When I press the date picker's button
    Then "house.olai" holds the node "order" with no date
    And the node "order" shows no date
    And there should be no page errors

  Scenario: A time is not a date on its own
    When I open the node menu of "knobs"
    And I choose "Set date…" from the node menu
    And I draft the time "09:00"
    Then the date picker's button is dead
    And the date picker offers to "Set date"
    When I draft the date "2026-09-01"
    Then the date picker offers to "Set date"
    When I press the date picker's button
    Then the date picker is closed
    And the node "knobs" shows the date "2026-09-01"

  @zone:America/New_York
  Scenario: A time written in another zone says so, and quotes what a change writes
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05","date":"2026-08-10T14:30:00-07:00"}
      """
    Then the node "install" is not shown
    When I open the date picker on "order"
    Then the date picker holds "2026-08-10" at "14:30"
    And the date picker says "Scheduled for 2026-08-10T14:30:00-07:00. A new day or time is saved in your time zone."
    And the date picker's button is dead
    When I draft the date "2026-12-01"
    Then the date picker says "Scheduled for 2026-08-10T14:30:00-07:00. This saves 2026-12-01T14:30:00-05:00, in your time zone."
    When I press the date picker's button
    Then "house.olai" holds the node "order" dated "2026-12-01T14:30:00-05:00"
    And there should be no page errors

  Scenario: A time written with a space opens with its time, and Enter does not take it off
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05","date":"2026-08-10 14:30"}
      """
    Then the node "install" is not shown
    When I open the date picker on "order"
    Then the date picker holds "2026-08-10" at "14:30"
    And the date picker's button is dead
    And the date picker says "Scheduled for 2026-08-10 14:30. A new day or time is saved in your time zone."
    And there should be no page errors

  @zone:America/New_York
  Scenario: A time the clock skips is written as the moment it becomes, and says so first
    When I open the node menu of "knobs"
    And I choose "Set date…" from the node menu
    And I draft the date "2026-03-08"
    And I draft the time "02:30"
    Then the date picker says "There is no 02:30 on 2026-03-08 in your time zone, so this saves 2026-03-08T03:30:00-04:00."
    When I press the date picker's button
    Then "house.olai" holds the node "knobs" dated "2026-03-08T03:30:00-04:00"
    And there should be no page errors

  Scenario: A half-typed time from the keyboard writes nothing until it is finished or taken off
    When I open the date picker on "order"
    And I draft the date "2026-09-01"
    And I press "ArrowUp" in the date picker's time box
    Then the date picker's button is dead
    And the date picker offers to "Set date"
    And the date picker says "The time is not finished. Finish it, or press No time."
    When I take the time off in the date picker
    Then the date picker holds "2026-09-01" at ""
    And the date picker says nothing
    When I press the date picker's button
    Then "house.olai" holds the node "order" dated "2026-09-01"
    And there should be no page errors

  Scenario: Emptying one segment of a stored time is not taking the time off
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05","date":"2026-08-10T14:30:00-04:00"}
      """
    Then the node "install" is not shown
    When I open the date picker on "order"
    And I press "Backspace" in the date picker's time box
    Then the date picker's button is dead
    And the date picker says "The time is not finished. Finish it, or press No time."
    When I take the time off in the date picker
    Then the date picker offers to "Clear time"
    When I press the date picker's button
    Then "house.olai" holds the node "order" dated "2026-08-10"
    And there should be no page errors

  Scenario: A date set here moves the node onto that day's page
    When I open the node menu of "knobs"
    And I choose "Set date…" from the node menu
    And I pick the date "2026-09-01"
    When I open the day "2026-09-01"
    Then the node "knobs" is shown
    And there should be no page errors

  Scenario: A past date on a task puts it above now on the line, without a reload
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
    When I open the date picker on "order"
    And I pick the date "2026-09-01"
    Then "house.olai" holds the node "order" dated "2026-09-01"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds the node "order" dated "2026-08-10"
    And the node "order" shows the date "2026-08-10"

  Scenario: The pill on a day page is not a control
    When I open the day "2026-08-10"
    Then the date on "order" does not open the picker
