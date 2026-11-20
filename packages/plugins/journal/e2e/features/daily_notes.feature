Feature: Daily notes
  A document whose basename is exactly an ISO date IS that day's note. No
  setting says so and nothing has to be filed anywhere in particular: the human's
  vault keeps `Daily/YYYY/MM/YYYY-MM-DD.md` and matches by arithmetic nobody had
  to be told, while `2019-11-09-recap.md` is a document ABOUT a day and
  deliberately nobody's note.

  The day page then has two halves. The note is what somebody WROTE about the
  day and is drawn first; the dated nodes are what the set says was ON it and
  are drawn below, exactly as before. That is a knowing amendment to "the
  journal is a query" rather than a hole in it — the note JOINS the query's
  answer and never replaces it, so a day with neither still has a page, and
  what such a day offers is an explicit + day note. Minting through it is
  document_editing.feature's subject rather than this one's.

  The fixtures are in 2019 for the reason the rest of the journal's are: a
  calendar is one of the few things whose behaviour depends on what day it is,
  and everything here is either anchored to a day the fixtures name or asks the
  clock the same question the browser does.

  @corpus:journal
  Scenario: The day's note is drawn above the day's own nodes
    When I open the day "2019-11-05"
    Then the day shows the note "Daily/2019/11/2019-11-05.md"
    And the document renders bold text "ferry"
    And the day groups are "life.olai, work.olai"
    And the day lists "ferry, posts, rails"
    And there should be no page errors

  @corpus:journal
  Scenario: A day with no note is the day it always was
    When I open the day "2019-11-06"
    Then the day shows no note
    And the day lists "pack"
    And the + day note button is shown
    And there should be no page errors

  @corpus:journal
  Scenario: An empty day offers + day note too
    When I open the day "2019-11-07"
    Then the day is empty
    And the + day note button is shown
    And there should be no page errors

  @corpus:journal
  Scenario: A day that already has a note does not offer + day note
    When I open the day "2019-11-05"
    Then the day shows the note "Daily/2019/11/2019-11-05.md"
    And the + day note button is gone
    And there should be no page errors

  @corpus:journal
  Scenario: The note's heading is the way to the document's own page
    Given I open the day "2019-11-05"
    And I mark the page
    When I follow the note's heading
    Then the document open is "Daily/2019/11/2019-11-05.md"
    And the address is "/Daily/2019/11/2019-11-05.md"
    And the page has not reloaded

  @corpus:journal
  Scenario: A relative link in the note lands on the document it names
    Given I open the day "2019-11-05"
    And I mark the page
    When I follow the link "the ferry timetable" in the rendered markdown
    Then the document open is "notes/ferry.md"
    And the address is "/notes/ferry.md"
    And the page has not reloaded
    And there should be no page errors

  @corpus:journal
  Scenario: The same link followed from the document's own page lands there too
    Given I open the document "Daily/2019/11/2019-11-05.md"
    And I mark the page
    When I follow the link "the ferry timetable" in the rendered markdown
    Then the document open is "notes/ferry.md"
    And the page has not reloaded

  @scratch:journal
  Scenario Outline: A relative link to a spaced name lands on that document
    Given I open the app
    And I rewrite "notes/the brief.md" as:
      """
      # The brief

      Oak counters.
      """
    And I rewrite "Daily/2019/11/2019-11-13.md" as:
      """
      # Tuesday

      See [the brief](<destination>).
      """
    And I open the day "2019-11-13"
    And the day shows the note "Daily/2019/11/2019-11-13.md"
    And I mark the page
    When I follow the link "the brief" in the rendered markdown
    Then the document open is "notes/the brief.md"
    And the address is "/notes/the%20brief.md"
    And the page has not reloaded
    And there should be no page errors

    Examples:
      | destination                   |
      | ../../../notes/the%20brief.md |
      | <../../../notes/the brief.md> |
      | ../../../notes/the brief.md   |

  @corpus:journal
  Scenario: A day whose only content is a note is still a day worth opening
    When I open the day "2019-11-08"
    Then the day shows the note "Daily/2019/11/2019-11-08.md"
    And the day has no dated nodes
    And the day does not say it is empty
    And there should be no page errors

  @corpus:journal
  Scenario: The month marks note-days apart from node-days
    When I open the day "2019-11-05"
    Then the day "2019-11-05" has something on it
    And the day "2019-11-05" has a note
    And the day "2019-11-06" has something on it
    And the day "2019-11-06" has no note
    And the day "2019-11-08" has a note
    And the day "2019-11-08" has nothing on it
    And the day "2019-11-08" is a link
    And the day "2019-11-07" is unmarked
    And the day "2019-11-07" is a link
    And the day "2019-11-09" is unmarked

  @corpus:journal
  Scenario: Two documents claiming one date are both the day's, in path order
    When I open the day "2019-11-12"
    Then the day shows the notes "Daily/2019/11/2019-11-12.md, notes/2019-11-12.md"
    And the day does not say it is empty
    And the day "2019-11-12" has a note
    And there should be no page errors

  @corpus:journal
  Scenario: A day cell says which marks it is wearing
    When I open the day "2019-11-05"
    Then the day "2019-11-05" is announced as "2019-11-05, has a note and dated items"
    And the day "2019-11-06" is announced as "2019-11-06, has dated items"
    And the day "2019-11-08" is announced as "2019-11-08, has a note"

  @corpus:journal
  Scenario: Clicking a note-day opens that day
    Given I open the day "2019-11-05"
    And I mark the page
    When I click the day "2019-11-08"
    Then the address is "/d/2019-11-08"
    And the day open is "2019-11-08"
    And the day shows the note "Daily/2019/11/2019-11-08.md"
    And the page has not reloaded

  @scratch:journal
  Scenario: Today's note reaches /today, and lights today in the month
    Given I open today
    And I mark the page
    Then the day is empty
    And today has no note
    When I write today's note
    Then the day shows today's note
    And today has a note
    And the page has not reloaded
    And there should be no page errors
