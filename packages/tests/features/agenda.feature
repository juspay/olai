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
    # Three late tasks on three different days, and the line runs through all
    # three before it reaches now — which is drawn whether or not anything is
    # due on it.
    Then the agenda spine runs "late, late, late, today"
    And the spine's "late" days are "2019-10-30, 2019-11-03, 2019-11-05"
    # TIME ORDER, across the outlines: `permit` is in work.olai and `visas` in
    # life.olai, and on a line a day is where a node goes. The old page grouped
    # by file first and read "visas, permit, posts".
    And the spine's "late" rows are "permit, visas, posts"
    # `doing` IS overdue-capable (human, 2026-08-12): started-but-unfinished is
    # the most honest answer to "should this have happened by now".
    And the node "permit" has status "doing"
    And there should be no page errors

  @corpus:agenda
  Scenario: A day says how far away it feels, and the chrome is gone
    When I open the agenda
    # No ISO date in a day heading: the weekday and the month are what a reader
    # feels. The page's own `data-date` and the heading's link still carry the
    # date itself. (The felt distance beside it — "7 years ago" — is not
    # asserted here: it is true today and will be eight of them one day.)
    Then the day "2019-11-05" says "Tue, Nov 5"
    # No file heading over any day — the repetition this page was redrawn to
    # lose. Which outline a row is in is the muted line under it.
    And the agenda draws no file headings
    # …and the ancestry is still there, as one muted line under the row itself.
    And the ancestors of "visas" are "the coast trip"
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
    Given I open the outline "work.olai"
    Then the date on "posts" is overdue
    # And an occurrence's pill never turns amber, however long ago its day was.
    And the date on "delivery" is not overdue
    When I open the day "2019-11-05"
    Then the date on "posts" is overdue
    When I open the node "posts"
    Then the date on "posts" is overdue

  @corpus:agenda
  Scenario: Now is a place on the line, drawn with nothing due on it
    When I open the agenda
    # The fixtures are dated in 2019, so nothing is due today — and the dot is
    # still there, saying so. A section would have vanished.
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
    # A route, not a reload: the page answered in place.
    And the page has not reloaded

  @scratch:agenda
  Scenario: Today is what today holds, and what is coming is the days ahead
    # Nothing in the fixtures is dated this century, so the line ends at now
    # until something is written past it — which is also the honest test of a
    # node arriving under an open page.
    Given I open the agenda
    And I mark the page
    Then the agenda spine runs "late, late, late, today"
    When something is scheduled for today in "work.olai"
    Then the spine's "today" rows are "due-today"
    When something is scheduled for tomorrow in "work.olai"
    Then the agenda spine runs "late, late, late, today, ahead"
    And the days ahead are tomorrow
    And the spine's "ahead" rows are "due-soon"
    # Each day's heading is the way to that day's own page, where the note
    # somebody wrote on it and the work already finished are read.
    And the day ahead for tomorrow links to that day
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: The future recedes — felt distance, a named silence, and no date pills
    # Two days ahead, a fortnight apart, so the line has a real gap in it. The
    # dates are written while the page is open because a tracked fixture cannot
    # name a day nobody knows in advance.
    Given I open the agenda
    And I mark the page
    When something is scheduled for tomorrow in "work.olai"
    And something is scheduled 14 days from today in "work.olai"
    Then the agenda spine runs "late, late, late, today, ahead, ahead"
    # Each says how far away it FEELS, in the unit a person would use.
    And the day for tomorrow says "Tomorrow"
    And the day 14 days from today says "in 2 weeks"
    # And the thirteen days between them are a silence the page names.
    And the agenda notes "two quiet weeks"
    # Neither row wears a date pill: the day above it has already said the day,
    # and neither of them is late or names a time.
    And "due-soon" wears no date pill
    And "due-in-14" wears no date pill
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: A day the filter takes out leaves ONE longer silence behind it
    # The silences are not data and are not narrowed: how long a wait is, is a
    # fact about the days still on the line. So taking the middle one out of
    # three has to close the two waits either side of it into a single longer
    # one — which is a thing only a recomputation can do.
    Given I open the agenda
    And I mark the page
    When something is scheduled for tomorrow in "work.olai"
    And something is scheduled 15 days from today in "work.olai"
    And something is scheduled 29 days from today in "work.olai"
    # A fortnight either side of the middle day.
    Then the agenda notes "two quiet weeks"
    When I filter the page by "due-soon OR due-in-29"
    # The 2019 days matched nothing and left; the middle day left too, and the
    # four weeks it stood in the middle of are ONE wait now.
    Then the agenda spine runs "today, ahead, ahead"
    And the agenda notes "four quiet weeks"
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: A late row's pill says HOW late, and a timed one says when
    # The two facts a day heading cannot give, and the only two a pill is kept
    # for on this page.
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

  # ── The directory carries the news ────────────────────────────────────
  #
  # Overdue is the one answer no day page can give — and a page nobody opens
  # cannot give it either. So the entry that leads to it says so from wherever
  # the reader is: the app's own alarm when something has slipped (a filled
  # chip, on a washed and weighted row), the date badge's quiet face for work
  # that is merely on today, and the entry it always was when neither. Loud
  # wins the row whole; the quieter number is still counted and still said.
  #
  # Every count here is the AGENDA'S OWN — the page's rows, counted where the
  # page's answer is assembled — so the number beside the word can never
  # disagree with the rows behind it.

  @corpus:agenda
  Scenario: Something slipped, and the entry to it is on fire
    Given I open the outline "work.olai"
    # Three late tasks over two outlines, counted as NODES: a mark saying "3"
    # means three things are late, not that three files or three days hold them.
    Then the agenda entry is on fire with 3 late
    And the agenda entry says "Agenda — 3 overdue"
    # The same three the page lists, one click away.
    When I follow the agenda link
    Then the spine's "late" rows are "permit, visas, posts"
    And there should be no page errors

  @corpus:agenda
  Scenario: Put the column away and the alarm goes with it
    Given I open the outline "work.olai"
    When I collapse the sidebar
    Then the sidebar rail is showing
    # A dot rather than a count — three rem has no room for a numeral, and the
    # number is one click away in the column this collapses.
    And the rail's agenda icon is on fire

  @corpus:agenda @phone
  Scenario: The same news through the burger
    Given I open the app
    # The directory is a sheet here, and the entry inside it is the same entry.
    # It is asked for VISIBLY: a sheet is rendered and hidden, and a mark nobody
    # can see is not a mark.
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
    # No chip at all rather than a nought: an agenda with nothing on it is a
    # door, not news.
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
    And the agenda entry says "Agenda — 1 on today"
    And the page has not reloaded

  @scratch:agenda
  Scenario: Both at once — the alarm wins the row, the nudge is still spoken
    Given I open the app
    And I mark the page
    When something is scheduled for today in "work.olai"
    # One number on a 13px row, and it is the one that decides whether to press.
    Then the agenda entry is on fire with 3 late
    And the agenda entry also carries 1 on today
    And the agenda entry says "Agenda — 3 overdue, 1 on today"
    And the page has not reloaded

  @scratch:agenda
  Scenario: The fire goes down as the work is finished, with no reload
    # The mark is the page's own reading, so it moves when the files do — which
    # is the whole of "live": a task ticked off in the tree leaves Overdue, and
    # the count beside the word in the column goes with it.
    Given I open the outline "work.olai"
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
    And the agenda draws no spine
    # Not a dead end: the directory is still the way on.
    And the outline list is shown
    And the page has not reloaded
    And there should be no page errors
