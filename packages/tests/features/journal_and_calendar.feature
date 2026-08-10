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
  inert, today wears a ring, and the day being read is filled.

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
  Scenario: A day lists every outline that has something on it, with context
    When I open the day "2019-11-05"
    Then the day open is "2019-11-05"
    # Grouped by outline, in path order, because a `parent` never crosses a
    # file: two nodes in two outlines have no shared ancestry to draw them
    # under, and the file is the only heading that is true.
    And the day groups are "life.jsonl, work.jsonl"
    # In time order within a group, and a bare date is the day itself — so it
    # comes before the two-thirty one, whatever order the file is written in.
    And the day lists "ferry, posts, rails"
    # A title torn out of its outline says nothing, so every node arrives with
    # the ancestry that says what it is about.
    And the ancestors of "ferry" are "the coast trip"
    And the ancestors of "posts" are "the deck #home"
    # The same node the tree would draw: derived status, inline tags, the note
    # as markdown — one component each, so a day cannot render them its own way.
    And the node "posts" has status "doing"
    And the description of "posts" renders bold text "before"
    And the title of "rails" styles the tag "home"
    And there should be no page errors

  @corpus:journal
  Scenario: A datetime counts for its calendar day
    # `ferry` is dated 2019-11-05T09:00 — a time on the 5th is on the 5th.
    When I open the day "2019-11-05"
    Then the node "ferry" is shown
    And the node "ferry" shows the date "2019-11-05T09:00"

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
    When I rewrite "work.jsonl" as:
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
