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
  answer and never replaces it, so a day with neither is still nowhere to GO —
  what such a day offers now is the mint affordance, which is
  document_editing.feature's subject rather than this one's.

  The fixtures are in 2019 for the reason the rest of the journal's are: a
  calendar is one of the few things whose behaviour depends on what day it is,
  and everything here is either anchored to a day the fixtures name or asks the
  clock the same question the browser does.

  @corpus:journal
  Scenario: The day's note is drawn above the day's own nodes
    When I open the day "2019-11-05"
    Then the day shows the note "Daily/2019/11/2019-11-05.md"
    # The same pipeline every other rendering on the page goes through.
    And the document renders bold text "ferry"
    # And the query's answer is untouched: the note joined it.
    And the day groups are "life.olai, work.olai"
    And the day lists "ferry, posts, rails"
    And there should be no page errors

  @corpus:journal
  Scenario: A day with no note is the day it always was
    When I open the day "2019-11-06"
    Then the day shows no note
    And the day lists "pack"
    And there should be no page errors

  @corpus:journal
  Scenario: The note's heading is the way to the document's own page
    Given I open the day "2019-11-05"
    And I mark the page
    When I follow the note's heading
    Then the document open is "Daily/2019/11/2019-11-05.md"
    And the address is "/Daily/2019/11/2019-11-05.md"
    # A route, not a reload: the page answered in place.
    And the page has not reloaded

  # The relative-link rule, asked where it is hardest. The note is rendered
  # under `/d/2019-11-05`, which is not a file at all — so a link left relative
  # would be resolved by the browser against the ROUTE. The base is the note's
  # own directory, three levels down, and the link climbs back out of it.
  @corpus:journal
  Scenario: A relative link in the note lands on the document it names
    Given I open the day "2019-11-05"
    And I mark the page
    When I follow the link "the ferry timetable" in the rendered markdown
    Then the document open is "notes/ferry.md"
    And the address is "/notes/ferry.md"
    And the page has not reloaded
    And there should be no page errors

  # The same link, from the document's own page, where the route happens to
  # agree with the file's directory. Both readings are the same arithmetic —
  # that is the point of asking twice.
  @corpus:journal
  Scenario: The same link followed from the document's own page lands there too
    Given I open the document "Daily/2019/11/2019-11-05.md"
    And I mark the page
    When I follow the link "the ferry timetable" in the rendered markdown
    Then the document open is "notes/ferry.md"
    And the page has not reloaded

  @corpus:journal
  Scenario: A day whose only content is a note is still a day worth opening
    When I open the day "2019-11-08"
    Then the day shows the note "Daily/2019/11/2019-11-08.md"
    And the day has no dated nodes
    # Not "nothing is on the 8th": the reader is looking at what they wrote on
    # it, and a page arguing with itself is worse than a page saying less.
    And the day does not say it is empty
    And there should be no page errors

  # The two marks are two marks. A reader has to tell a day that holds WRITING
  # from a day that has work on it, and from a day that has both, at a glance —
  # so `data-noted` and `data-dated` are separate facts and this counts all four
  # combinations against the fixtures.
  @corpus:journal
  Scenario: The month marks note-days apart from node-days
    When I open the day "2019-11-05"
    # Both: nodes are dated the 5th and a note is named for it.
    Then the day "2019-11-05" has something on it
    And the day "2019-11-05" has a note
    # Nodes only.
    And the day "2019-11-06" has something on it
    And the day "2019-11-06" has no note
    # A note only — and still a link, because it has something to show.
    And the day "2019-11-08" has a note
    And the day "2019-11-08" has nothing on it
    And the day "2019-11-08" is a link
    # Neither, so inert: nowhere to go. (Pressing one MINTS the day's note
    # now — document_editing.feature — so inert means "not a link", not
    # "nothing to press".)
    And the day "2019-11-07" is inert
    # And a document that merely NAMES a date leaves its day inert too.
    And the day "2019-11-09" is inert

  # The mid-migration vault, which is the one case the design named for listing
  # both: a folder convention changed and the older note stayed where it was.
  # There is no conflict rule to invent over two files a person wrote, so BOTH
  # are drawn and path order is the whole of the answer. Asked in the browser
  # as well as in the unit test, because the page is where the second one would
  # be dropped — a banner, a pick-one, an empty day — while a derivation that
  # still returns two stays green.
  @corpus:journal
  Scenario: Two documents claiming one date are both the day's, in path order
    When I open the day "2019-11-12"
    Then the day shows the notes "Daily/2019/11/2019-11-12.md, notes/2019-11-12.md"
    And the day does not say it is empty
    And the day "2019-11-12" has a note
    And there should be no page errors

  # The two marks are a shape in a place, and a pseudo-element has no text — so
  # the facts are SAID as well as drawn, or a calendar announces every live day
  # identically to a reader using a screen reader.
  @corpus:journal
  Scenario: A day cell says which marks it is wearing
    When I open the day "2019-11-05"
    Then the day "2019-11-05" is announced as "2019-11-05, has a note and dated nodes"
    And the day "2019-11-06" is announced as "2019-11-06, has dated nodes"
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

  # `/today` names no day: it names the day it IS. The only way a fixture can
  # have a note on today is that a write puts it there while the scenario runs,
  # which is also the honest test of a `.md` dropped into the directory — the
  # calendar's second mark and the day's own note both arrive with no reload.
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
