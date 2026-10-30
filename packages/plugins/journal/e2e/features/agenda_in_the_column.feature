Feature: What is owed, listed under the door
  The Agenda door says something slipped; this says WHAT, without leaving the
  page a reader is on. Under the door is a short list of the owed rows — late
  work first, oldest day first, then today's — so a reader working in an
  outline can see the two things that are late and finish one of them here.

  The list and the chip are fields of ONE server reading, so they cannot
  disagree for a frame. The rows are the agenda's own, in the agenda's order,
  reached through the agenda's own rows: a press opens the node where it lives.

  Three things decide whether the list is drawn, and each is a different fact:
  anything owed at all, the agenda not being the page in front (the page is the
  fuller answer, so the column does not repeat it), and this browser's fold
  (`olai.sidebar.agenda-rows`, followed across tabs, unfolded by default).
  Folding never stops the reading, which is what keeps the count live while the
  list is shut.

  @corpus:agenda
  Scenario: The fixtures' late work is listed under the door, oldest day first
    Given I open the outline "work.olai"
    # Three late tasks over two outlines, in TIME order rather than the files':
    # `permit` is in work.olai and `visas` in life.olai.
    Then the column's agenda rows are "permit, visas, posts"
    And the column's row "permit" wears a filled mark
    # How long ago its day was, in the spine's own words — "Yesterday" means
    # here what it means on the page one click away.
    And every late row says how far away its day feels
    And the agenda entry says "Agenda — 3 overdue"
    And there should be no page errors

  @corpus:agenda
  Scenario: The list is absent while the agenda is in front, and back on leaving
    Given I open the outline "work.olai"
    And I mark the page
    Then the column's agenda rows are "permit, visas, posts"
    When I open the agenda
    # The page is the fuller answer; the door keeps its count.
    Then the column draws no agenda rows
    And the column draws no fold
    And the agenda entry is on fire with 3 late
    # Back on the outline — reached cold here, which is why this half asks only
    # that the list is back: "in place" is the row-press scenario's claim.
    When I open the outline "work.olai"
    Then the column's agenda rows are "permit, visas, posts"
    And there should be no page errors

  @corpus:agenda
  Scenario: A row opens the node where it lives
    Given I open the outline "work.olai"
    And I mark the page
    When I press the column's row "permit"
    # The agenda page's own rows reach a node the same way.
    Then the address is "/zoom/#permit"
    And the node "permit" is shown
    And the page has not reloaded

  @scratch:agenda
  Scenario: Work due today appears under the late rows, with a ring and nothing after it
    Given I open the outline "work.olai"
    And I mark the page
    When something is scheduled for today in "work.olai"
    Then the column's agenda rows are "permit, visas, posts, due-today"
    And the column's row "due-today" wears a ring mark
    # A today row says its title and stops: "Today" under a door that already
    # said it is a word spent on no news.
    And the column's row "due-today" says "call the surveyor"
    And the column's row "due-today" is not late
    And the agenda entry says "Agenda — 3 overdue, 1 due today"
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: A row's title follows the file while both counts stand still
    Given I open the outline "work.olai"
    And I mark the page
    And the column's row "posts" is named "dig the post holes"
    # One late node is still one: neither count moves, so what has to arrive on
    # its own is the ROW — which is why the reading compares the rows and not
    # only the numbers over them.
    When the title of "posts" is rewritten as "dig the post holes deeper" on disk
    Then the column's row "posts" is named "dig the post holes deeper"
    And the agenda entry is on fire with 3 late
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: The cap holds, and the rest is one line to the page
    Given I open the outline "work.olai"
    And I mark the page
    # Seven late rows: three in the fixtures, four written while the page is
    # open. Five fit; the other two are the line under them.
    When four more tasks are due yesterday in "work.olai"
    Then the column draws 5 agenda rows
    # The wording itself, pinned by work written relative to the clock: the
    # fixtures' own distance is "seven years ago" today and something else
    # next year.
    And the column's row "more-1" says "the 1 thing left over Yesterday"
    And the column says "2 more on the agenda"
    When I follow the more line
    Then the address is "/agenda"
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: Clearing a date takes its row away with no reload
    Given I open the outline "work.olai"
    And I mark the page
    Then the column's agenda rows are "permit, visas, posts"
    # `visas` is the 2019 row in life.olai; the list is a reading, so it moves
    # when the files do.
    When every date is taken off "life.olai"
    Then the column's agenda rows are "permit, posts"
    And the page has not reloaded

  @scratch:agenda
  Scenario: The fold puts the list away, remembers it, and the count stays live
    Given I open the outline "work.olai"
    And I mark the page
    When I fold the agenda rows
    Then the agenda rows are folded away
    When I reload the page
    Then the agenda rows are folded away
    # Folding is drawing: the stream keeps running, so a row written now moves
    # the count on a door whose list is shut.
    When something is scheduled for today in "work.olai"
    Then the agenda entry is on fire with 3 late
    And the agenda entry also carries 1 on today
    And the agenda rows are folded away
    When I unfold the agenda rows
    Then the column's agenda rows are "permit, visas, posts, due-today"
    And there should be no page errors

  @scratch:agenda
  Scenario: Nothing owed is the plain door it always was — no list, no chevron
    Given I open the outline "work.olai"
    And I mark the page
    When every date is taken off "life.olai"
    And every date is taken off "work.olai"
    Then the agenda entry is quiet
    And the column draws no agenda rows
    And the column draws no fold
    And the page has not reloaded

  @scratch:agenda
  Scenario: Switching the journal row off takes the rows with it
    Given I open the outline "work.olai"
    Then the column's agenda rows are "permit, visas, posts"
    When I open the plugins panel
    And I switch the plugin "journal" off
    And I press Escape on the preferences
    Then the journal chrome is absent
    And there should be no page errors

  @scratch:agenda @phone
  Scenario: On a phone a row press puts the drawer away and opens the node
    Given I open the outline "work.olai"
    And I mark the page
    When I tap the burger
    Then the column's agenda rows are "permit, visas, posts"
    When I tap the column's row "permit"
    Then the address is "/zoom/#permit"
    And the sidebar is put away
