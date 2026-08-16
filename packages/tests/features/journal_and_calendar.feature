Feature: The journal, and the month in the sidebar
  The journal is a QUERY, not a place. Nothing on disk says "this is the 5th of
  November": a day is every node in the served directory carrying that date,
  wherever it was written — so the month in the sidebar aggregates the whole
  set and no filename is special about anything.

  The fixtures date their nodes in 2019 on purpose. A calendar is one of the
  few things whose behaviour depends on what day it is, and a suite that could
  only pass this month is a suite that fails for reasons nobody changed. So
  everything here is either anchored to a day the fixtures name, or asks the
  clock the same question the browser does.

  Three marks, and they are three because a reader has to tell them apart at a
  glance: a day with something on it is a link with a dot, an empty day is
  inert — a quiet number, not a link; pressing one mints the day's note, which
  is document_editing.feature's subject — today wears a ring, and the day
  being read is filled.

  @corpus:journal
  Scenario: A day with something on it is a link, and an empty one is not
    # Opening a day anchors the calendar to that day's month, which is how a
    # month whose days are two olympiads in the past is on screen at all.
    When I open the day "2019-11-05"
    Then the month shown is "2019-11"
    And the day "2019-11-05" has something on it
    And the day "2019-11-06" has something on it
    And the day "2019-11-07" is inert
    And there should be no page errors

  @corpus:journal
  Scenario: The day being read is filled, and only that one
    When I open the day "2019-11-05"
    Then the day "2019-11-05" is the one being read
    And the day "2019-11-06" is not the one being read

  @corpus:journal
  Scenario: Today wears a ring, on whatever page
    # Today is asked of the clock rather than written down, so this scenario
    # says the same thing on every day it is ever run.
    When I open the app
    Then today wears the ring
    And today is not the one being read

  @corpus:journal
  Scenario: Clicking a day opens that day
    Given I open the day "2019-11-05"
    And I mark the page
    When I click the day "2019-11-06"
    Then the address is "/d/2019-11-06"
    And the day open is "2019-11-06"
    And the node "pack" is shown
    # A route, not a reload: the page answered in place.
    And the page has not reloaded

  @corpus:journal
  Scenario: Two days, read in turn, each still says what it said
    # A day is a QUERY over the whole set, and asking it twice must not answer
    # differently the second time. What a day lists are the set's OWN records,
    # handed over rather than copied — so anything this page did to what it was
    # given, it would be doing to the outline every other page is read from,
    # and the second day read would be the first day's answer with another
    # day's fields in it. Nothing in the client writes, and this is the
    # scenario that says so.
    When I open the day "2019-11-05"
    Then the day lists "ferry, posts, rails"
    When I click the day "2019-11-06"
    Then the day open is "2019-11-06"
    And the day lists "pack"
    When I click the day "2019-11-05"
    Then the day open is "2019-11-05"
    And the day groups are "life.olai, work.olai"
    And the day lists "ferry, posts, rails"
    And the ancestors of "ferry" are "the coast trip"
    And there should be no page errors

  @corpus:journal
  Scenario: A day lists every outline that has something on it, with context
    When I open the day "2019-11-05"
    Then the day open is "2019-11-05"
    # Grouped by outline, in path order, because a `parent` never crosses a
    # file: two nodes in two outlines have no shared ancestry to draw them
    # under, and the file is the only heading that is true.
    And the day groups are "life.olai, work.olai"
    # In time order within a group, and a bare date is the day itself — so it
    # comes before the two-thirty one, whatever order the file is written in.
    And the day lists "ferry, posts, rails"
    # A title torn out of its outline says nothing, so every node arrives with
    # the ancestry that says what it is about.
    And the ancestors of "ferry" are "the coast trip"
    And the ancestors of "posts" are "the deck #home"
    # The same node the tree would draw: its mark, its inline tags, and a row
    # that is its TITLE with the note behind a pilcrow — one component each, so
    # a day cannot render them its own way, and the density preference reaches
    # here exactly as it reaches the tree (note_density.feature).
    And the node "posts" has status "doing"
    And the node "posts" shows a pilcrow
    And the node "posts" draws nothing under its title
    When I open the note of "posts"
    Then the description of "posts" renders bold text "before"
    And the title of "rails" styles the tag "home"
    And there should be no page errors

  @corpus:journal
  Scenario: A datetime counts for its calendar day
    # `ferry` is dated 2019-11-05T09:00 — a time on the 5th is on the 5th.
    When I open the day "2019-11-05"
    Then the node "ferry" is shown
    And the node "ferry" shows the date "2019-11-05T09:00"


  @corpus:journal
  Scenario: A mark's own date puts a node on that day
    # Every date a node carries counts, not only its `date` field: `survey` was
    # scheduled for the 28th and FINISHED on the 29th, and the 29th is a day
    # with something on it because of the mark alone. That is the whole of the
    # requirement — work that was done vanished from the calendar while only
    # `date` was read.
    When I open the day "2019-10-29"
    Then the day "2019-10-29" has something on it
    And the day lists "survey"
    And the node "survey" has status "done"
    And there should be no page errors

  @corpus:journal
  Scenario: A date on a `todo` is not a day
    # Two fields put a node on a day — `date` and a dated `done` — and the
    # other two marks are passed over however legal their dates are (resolved
    # 2026-08-11 by the human, from a day page buried under everything filed
    # that morning). `filed` carries `todo: 2019-11-21` and nothing else, so
    # the 21st has nothing on it: no dot to press, and a page that says so.
    When I open the day "2019-11-21"
    Then the day "2019-11-21" is inert
    And the day is empty
    And there should be no page errors

  @corpus:journal
  Scenario: A node with two dates is on both days, and each says which
    # Scheduled-on and completed-on are two different sentences about one node,
    # so a reader has to be able to tell which one they are reading. The badge
    # says it in a word, and it shows the date the row is actually there for.
    When I open the day "2019-10-28"
    Then the day lists "survey"
    And the node "survey" shows the date "2019-10-28"
    And the node "survey" is on the day for its "date"
    When I click the day "2019-10-29"
    Then the day open is "2019-10-29"
    And the day lists "survey"
    And the node "survey" shows the date "2019-10-29"
    And the node "survey" is on the day for its "done"

  @corpus:journal
  Scenario: Today, opened, is the fill inside the ring
    # The two marks are different things and they stack: the ring says which
    # day it is, the fill says you are standing on it. `/today` is the one
    # address where a single cell has to carry both, so it is the one place
    # the compound can be asserted rather than the two marks separately.
    When I open today
    Then today wears the ring
    And today is the one being read

  @corpus:journal
  Scenario: A day with nothing on it says so, and offers nothing
    # Nothing in these fixtures is dated this century, so `/today` is empty
    # whenever this runs. Creating a day is a WRITE, and this pane writes
    # nothing — an empty day promising what it cannot do would be worse.
    When I open today
    Then the day is empty
    And no outline tree is shown
    # Not a dead end: the sidebar is still the way on.
    And the outline list is shown
    And there should be no page errors

  @corpus:journal
  Scenario: An address that names no day is answered, not broken
    # `/d/<anything>` is a URL a person can type. Nothing is dated `hello`,
    # which is a true statement and the whole answer — the day view says it,
    # and the calendar, which cannot lay out a month it does not have, stays on
    # the one a reader can still use.
    When I open the day "hello"
    Then the day open is "hello"
    And the day is empty
    And the month shown is this month
    And there should be no page errors

  @corpus:journal
  Scenario: Paging back a month shows that month's days
    Given I open the day "2019-11-05"
    When I page the calendar back
    Then the month shown is "2019-10"
    And the day "2019-10-28" has something on it
    And the day "2019-10-27" is inert
    # Paging is a way of LOOKING and has nowhere to go: the address bar still
    # names the day being read.
    And the address is "/d/2019-11-05"
    When I page the calendar forward
    Then the month shown is "2019-11"

  @scratch:journal
  Scenario: A dated node written to disk lights its day, with no reload
    Given I open the day "2019-11-05"
    And I mark the page
    Then the day "2019-11-20" is inert
    When I rewrite "work.olai" as:
      """
      {"id":"deck","ord":"a0","title":"the deck #home"}
      {"id":"posts","parent":"deck","ord":"a0","title":"dig the post holes","doing":true,"date":"2019-11-05","desc":"Call the utility line **before** digging."}
      {"id":"rails","parent":"deck","ord":"a1","title":"order the railings #home","date":"2019-11-05T14:30"}
      {"id":"sweep","parent":"deck","ord":"a2","title":"sweep the yard"}
      {"id":"stain","parent":"deck","ord":"a3","title":"stain the boards","date":"2019-11-20"}
      {"id":"survey","ord":"a1","title":"the boundary survey","done":"2019-10-29","date":"2019-10-28"}
      """
    Then the day "2019-11-20" has something on it
    And the page has not reloaded
