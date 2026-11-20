Feature: The agenda — what is owed, on one line of time
  The agenda is a QUERY, not a place, exactly as a day page is: nothing on disk
  is the agenda. It is every dated node in the served directory read FORWARD —
  what slipped, what is on today, what is coming — and the reading is `date`
  and the mark together, with no new field anywhere.

  It is DRAWN as one continuous spine of time (`agenda-spine`, ruled
  2026-08-18): a line down the left with NOW marked on it, every listed day a
  dot, what has gone above it and what is coming below it, receding. There are
  no Overdue / Today / Upcoming boxes — three boxes gave a task seventy-three
  days out the same claim on a reader as one due on Monday — so a scenario here
  asks which SIDE OF NOW a day is on (`data-when`) rather than which heading it
  was filed under.

  Which is the whole of it: a date with a `todo` or a `doing` on it is work
  somebody said was work and said when, and that is the only thing the agenda
  lists — the only thing that can be late. A date with no mark is an
  occurrence — a delivery, a birthday — and it stays on its day page and in
  the calendar. A day passing is not a failure of a bullet.

  The fixtures are dated in 2019 on purpose, like the journal's: everything in
  them is overdue on every day this suite will ever run, and the scenarios
  about today and the days ahead write what they need while the page is open.

  The last half of this feature is the same answer read from OUTSIDE the page:
  the directory's own entry marks what is owed, so a reader in an outline finds
  out that something slipped without opening the page that would have said so.

  @corpus:agenda
  Scenario: What slipped is a run of days above now, oldest first
    When I open the agenda
    Then the agenda spine runs "late, late, late, today"
    And the spine's "late" days are "2019-10-30, 2019-11-03, 2019-11-05"
    And the spine's "late" rows are "permit, visas, posts"
    And the node "permit" has status "doing"
    And there should be no page errors

  @corpus:agenda
  Scenario: A day says how far away it feels, and the chrome is gone
    When I open the agenda
    Then the day "2019-11-05" says "Tue, Nov 5"
    And the agenda draws no file headings
    And the ancestors of "visas" are "the coast trip"
    And there should be no page errors

  @corpus:agenda
  Scenario: A task torn out of its outline still says what it is about
    When I open the agenda
    Then the ancestors of "visas" are "the coast trip"
    And the node "posts" is shown
    And the node "posts" has the title "dig the post holes"

  @corpus:agenda
  Scenario: What is never on it
    When I open the agenda
    Then the agenda does not list "delivery"
    And the agenda does not list "survey"
    And the agenda does not list "paint"
    And the agenda does not list "latch"
    And the agenda does not list "photos"

  @corpus:agenda
  Scenario: A blocked task keeps both answers
    When I open the agenda
    Then the node "visas" is blocked by "photos"
    And the node "visas" shows the waiting mark
    And the date on "visas" is overdue

  @corpus:agenda
  Scenario: The pill takes the attention tone wherever the row is drawn
    Given I open the outline "work.olai"
    Then the date on "posts" is overdue
    And the date on "delivery" is not overdue
    When I open the day "2019-11-05"
    Then the date on "posts" is overdue
    When I open the node "posts"
    Then the date on "posts" is overdue

  @corpus:agenda
  Scenario: Now is a place on the line, drawn with nothing due on it
    When I open the agenda
    Then the agenda spine runs "late, late, late, today"
    And the day "2019-11-05" says "Tue, Nov 5"
    And there should be no page errors

  @corpus:agenda
  Scenario: The agenda is one address, reachable from the directory
    Given I open the app
    And I mark the page
    When I follow the agenda link
    Then the address is "/agenda"
    And the agenda says it is today
    And the page has not reloaded

  @scratch:agenda
  Scenario: Today is what today holds, and what is coming is the days ahead
    Given I open the agenda
    And I mark the page
    Then the agenda spine runs "late, late, late, today"
    When something is scheduled for today in "work.olai"
    Then the spine's "today" rows are "due-today"
    When something is scheduled for tomorrow in "work.olai"
    Then the agenda spine runs "late, late, late, today, ahead"
    And the days ahead are tomorrow
    And the spine's "ahead" rows are "due-soon"
    And the day ahead for tomorrow links to that day
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: The future recedes — felt distance, a named silence, and no date pills
    Given I open the agenda
    And I mark the page
    When something is scheduled for tomorrow in "work.olai"
    And something is scheduled 14 days from today in "work.olai"
    Then the agenda spine runs "late, late, late, today, ahead, ahead"
    And the day for tomorrow says "Tomorrow"
    And the day 14 days from today says "in 2 weeks"
    And the agenda notes "two quiet weeks"
    And "due-soon" wears no date pill
    And "due-in-14" wears no date pill
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: A day the filter takes out leaves ONE longer silence behind it
    Given I open the agenda
    And I mark the page
    When something is scheduled for tomorrow in "work.olai"
    And something is scheduled 15 days from today in "work.olai"
    And something is scheduled 29 days from today in "work.olai"
    Then the agenda notes "two quiet weeks"
    When I filter the page by "due-soon OR due-in-29"
    Then the agenda spine runs "today, ahead, ahead"
    And the agenda notes "four quiet weeks"
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: A late row's pill says HOW late, and a timed one says when
    Given I open the agenda
    And I mark the page
    When something is scheduled for yesterday in "work.olai"
    Then the pill on "due-yesterday" says "1 day late"
    And the date on "due-yesterday" is overdue
    When something is scheduled for two o'clock tomorrow in "work.olai"
    Then the pill on "due-at-two" says "14:00"
    And the date on "due-at-two" is not overdue
    And the page has not reloaded
    And there should be no page errors

  @corpus:agenda
  Scenario: Something slipped, and the entry to it is on fire
    Given I open the outline "work.olai"
    Then the agenda entry is on fire with 3 late
    And the agenda entry says "Agenda — 3 overdue"
    When I follow the agenda link
    Then the spine's "late" rows are "permit, visas, posts"
    And there should be no page errors

  @corpus:agenda
  Scenario: Put the column away and the alarm goes with it
    Given I open the outline "work.olai"
    When I collapse the sidebar
    Then the sidebar rail is showing
    And the rail's agenda icon is on fire

  @corpus:agenda @phone
  Scenario: The same news through the burger
    Given I open the app
    When I tap the burger
    Then the agenda entry is on fire with 3 late

  @scratch:agenda
  Scenario: Nothing owed is the quiet entry it always was
    Given I open the app
    And I mark the page
    Then the agenda entry is on fire with 3 late
    When every date is taken off "life.olai"
    And every date is taken off "work.olai"
    Then the agenda entry is quiet
    And the agenda entry wears no count
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: Work on today is a nudge, and the entry stays quiet about it
    Given I open the app
    And I mark the page
    When every date is taken off "life.olai"
    And every date is taken off "work.olai"
    And something is scheduled for today in "work.olai"
    Then the agenda entry nudges with 1 on today
    And the agenda entry says "Agenda — 1 due today"
    And the page has not reloaded

  @scratch:agenda
  Scenario: Both at once — the alarm wins the row, the nudge is still spoken
    Given I open the app
    And I mark the page
    When something is scheduled for today in "work.olai"
    Then the agenda entry is on fire with 3 late
    And the agenda entry also carries 1 on today
    And the agenda entry says "Agenda — 3 overdue, 1 due today"
    And the page has not reloaded

  @scratch:agenda
  Scenario: The fire goes down as the work is finished, with no reload
    Given I open the outline "work.olai"
    And I show the done nodes
    And I mark the page
    Then the agenda entry is on fire with 3 late
    When I click the title of "posts"
    And I press "Control+Enter"
    Then the node "posts" has status "done"
    And the agenda entry is on fire with 2 late
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: An agenda with nothing due says so, and offers nothing to press
    Given I open the agenda
    And I mark the page
    When every date is taken off "life.olai"
    And every date is taken off "work.olai"
    Then the agenda is empty
    And the empty page says "Nothing due" over "Rows with a date show up here."
    And the empty page "Nothing due" offers nothing to press
    And the agenda draws no spine
    And the outline list is shown
    And the page has not reloaded
    And there should be no page errors
