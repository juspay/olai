Feature: The agenda — what is owed
  The agenda is a QUERY, not a place, exactly as a day page is: nothing on disk
  is the agenda. It is every dated node in the served directory read FORWARD —
  what slipped, what is on today, what is coming — and the reading is `date`
  and the mark together, with no new field anywhere.

  Which is the whole of it: a date with a `todo` or a `doing` on it is work
  somebody said was work and said when, and that is the only thing that can be
  late. A date with no mark is an occurrence — a delivery, a birthday — and a
  day passing is not a failure of a bullet.

  The fixtures are dated in 2019 on purpose, like the journal's: everything in
  them is overdue on every day this suite will ever run, and the two scenarios
  about today and the days ahead write what they need while the page is open.

  @corpus:agenda
  Scenario: Overdue is every slipped task, oldest first, grouped by outline
    When I open the agenda
    Then the agenda has the sections "overdue"
    # Grouped by outline, in path order, because a `parent` never crosses a
    # file — the same heading a day page uses, for the same reason.
    And the "overdue" section groups are "life.jsonl, work.jsonl"
    # `permit` is dated before `posts` and written after it, so a page ordering
    # by line rather than by date would put them the other way round.
    And the "overdue" section lists "visas, permit, posts"
    # `doing` IS overdue-capable (human, 2026-08-12): started-but-unfinished is
    # the most honest answer to "should this have happened by now".
    And the node "permit" has status "doing"
    And there should be no page errors

  @corpus:agenda
  Scenario: A task torn out of its outline still says what it is about
    # The agenda collects from all over the set, so every node arrives with the
    # ancestry, mark and note a day page gives it — the same component, because
    # it is the same row.
    When I open the agenda
    Then the ancestors of "visas" are "the coast trip"
    And the node "posts" is shown
    And the node "posts" has the title "dig the post holes"

  @corpus:agenda
  Scenario: What is never on it
    When I open the agenda
    # An occurrence whose day has passed simply leaves: it was not work.
    Then the agenda does not list "delivery"
    # Finished work is a day page's answer, not this one's.
    And the agenda does not list "survey"
    # A task nobody scheduled has no *when* to be late against, and inventing
    # one is what this format refuses to do.
    And the agenda does not list "paint"
    # A date on the MARK is a fact about the task's paperwork; no view reads it
    # as a day, and this one does not either.
    And the agenda does not list "latch"
    # The blocker is undated, so it holds something up without being owed.
    And the agenda does not list "photos"

  @corpus:agenda
  Scenario: A blocked task keeps both answers
    # Being blocked is a SECOND fact about a node and never a replacement for
    # the first, and so is being late. `visas` is both, and says both.
    When I open the agenda
    Then the node "visas" is blocked by "photos"
    And the node "visas" shows the waiting mark
    And the date on "visas" is overdue

  @corpus:agenda
  Scenario: The pill takes the attention tone wherever the row is drawn
    # One predicate, read everywhere: the agenda's first section and the tone
    # of a date badge are the same question, so a row that is late reads late
    # in the tree it lives in as much as on the page that collects it.
    Given I open the outline "work.jsonl"
    Then the date on "posts" is overdue
    # And an occurrence's pill never turns amber, however long ago its day was.
    And the date on "delivery" is not overdue
    When I open the day "2019-11-05"
    Then the date on "posts" is overdue
    When I open the node "posts"
    Then the date on "posts" is overdue

  @corpus:agenda
  Scenario: The agenda is one address, reachable from the directory
    Given I open the app
    And I mark the page
    When I follow the agenda link
    Then the address is "/agenda"
    And the agenda says it is today
    # A route, not a reload: the page answered in place.
    And the page has not reloaded

  @scratch:agenda
  Scenario: Today is what today holds, and what is coming is the days ahead
    # Nothing in the fixtures is dated this century, so the two forward sections
    # are empty until something is written into them — which is also the honest
    # test of a node arriving under an open page.
    Given I open the agenda
    And I mark the page
    Then the agenda has the sections "overdue"
    When something is scheduled for today in "work.jsonl"
    Then the agenda has the sections "overdue, today"
    And the "today" section lists "due-today"
    When something is scheduled for tomorrow in "work.jsonl"
    Then the agenda has the sections "overdue, today, upcoming"
    And the upcoming days are tomorrow
    And the "upcoming" section lists "due-soon"
    # Each upcoming heading is the way to that day's own page, where the note
    # somebody wrote on it and the work already finished are read.
    And the upcoming day for tomorrow links to that day
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: An agenda with nothing due says so, and offers nothing to press
    Given I open the agenda
    And I mark the page
    When every date is taken off "life.jsonl"
    And every date is taken off "work.jsonl"
    Then the agenda is empty
    And the agenda has no sections
    # Not a dead end: the directory is still the way on.
    And the outline list is shown
    And the page has not reloaded
    And there should be no page errors
