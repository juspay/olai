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

  Four marks, and they are four because a reader has to tell them apart at a
  glance: a day with something on it is a link with a dot, a day with a note
  wears a corner fold, today wears a ring, and the day being read is filled.
  Every cell is a link — a day with neither of the first two is quiet, not
  inert, and the click never writes. Creating a note is the day page's, not
  the cell's (document_editing.feature).

  @corpus:journal
  Scenario: A day with something on it is marked, and an empty one is quiet
    When I open the day "2019-11-05"
    Then the month shown is "2019-11"
    And the day "2019-11-05" has something on it
    And the day "2019-11-06" has something on it
    And the day "2019-11-07" is unmarked
    And the day "2019-11-07" is a link
    And there should be no page errors

  @corpus:journal
  Scenario: The day being read is filled, and only that one
    When I open the day "2019-11-05"
    Then the day "2019-11-05" is the one being read
    And the day "2019-11-06" is not the one being read

  @corpus:journal
  Scenario: Today wears a ring, on whatever page
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
    And the page has not reloaded

  @corpus:journal
  Scenario: Clicking an empty day opens that day, and writes nothing
    Given I open the day "2019-11-05"
    And I mark the page
    When I click the day "2019-11-07"
    Then the address is "/d/2019-11-07"
    And the day open is "2019-11-07"
    And the day is empty
    And the document editor is gone
    And the page has not reloaded

  @corpus:journal
  Scenario: Two days, read in turn, each still says what it said
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
    And the day groups are "life.olai, work.olai"
    And the day lists "ferry, posts, rails"
    And the ancestors of "ferry" are "the coast trip"
    And the ancestors of "posts" are "the deck #home"
    And the node "posts" has status "doing"
    And the node "posts" shows a pilcrow
    When I read the outline with Notes on "compact"
    Then the node "posts" shows a pilcrow
    And the node "posts" draws nothing under its title
    When I open the note of "posts"
    Then the description of "posts" renders bold text "before"
    And the title of "rails" styles the tag "home"
    And there should be no page errors

  @corpus:journal
  Scenario: A datetime counts for its calendar day
    When I open the day "2019-11-05"
    Then the node "ferry" is shown
    And the node "ferry" shows the date "2019-11-05T09:00"


  @corpus:journal
  Scenario: A mark's own date puts a node on that day
    When I open the day "2019-10-29"
    Then the day "2019-10-29" has something on it
    And the day lists "survey"
    And the node "survey" has status "done"
    And there should be no page errors

  @corpus:journal
  Scenario: A date on a `todo` is not a day
    When I open the day "2019-11-21"
    Then the day "2019-11-21" is unmarked
    And the day is empty
    And there should be no page errors

  @corpus:journal
  Scenario: A node with two dates is on both days, and each says which
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
    When I open today
    Then today wears the ring
    And today is the one being read

  @corpus:journal
  Scenario: A day with nothing on it says so, and offers + day note
    When I open today
    Then the day is empty
    And the + day note button is shown
    And no outline tree is shown
    And the outline list is shown
    And there should be no page errors

  @corpus:journal
  Scenario: An address that names no day is answered, not broken
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
    And the day "2019-10-27" is unmarked
    And the address is "/d/2019-11-05"
    When I page the calendar forward
    Then the month shown is "2019-11"

  @scratch:journal
  Scenario: A dated node written to disk lights its day, with no reload
    Given I open the day "2019-11-05"
    And I mark the page
    Then the day "2019-11-20" is unmarked
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
