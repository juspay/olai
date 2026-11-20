Feature: The filter reaches every page that draws nodes
  Filtering in place shipped on the outline pages (`filter_in_place.feature`)
  and stopped there: a day, the agenda and the trash drew the same rows, out of
  the same set, through the same components — and ignored the box entirely.
  These scenarios are the other three doors, and the promise is that they are
  not a fourth, fifth and sixth thing to learn: same grammar, same ancestors,
  same count, same refusal.

  What is DIFFERENT is what each page is made of, and each difference is a
  scenario here rather than a paragraph somewhere:

    - a day and the agenda draw FLAT rows that already carry their ancestry, so
      nothing is kept as context — what is left is exactly what matched, and an
      outline with nothing left stops being a heading;
    - a day's NOTE is a document, which this grammar says nothing about, so a
      filtered day is the answer and not the answer plus somebody's prose;
    - the trash is the ARCHIVE, which every other door leaves alone unless the
      query says `is:trashed` — here the page has already decided, and a word
      typed into the box searches what is in front of the reader.

  @corpus:journal
  Scenario: A day narrows to what matched, and the outline with none goes
    Given I open the day "2019-11-05"
    Then the day groups are "life.olai, work.olai"
    And the day lists "ferry, posts, rails"
    When I filter the page by "#home"
    Then the day lists "rails"
    And the day groups are "work.olai"
    And the filter found "1 of 3"
    And the node "rails" is a match
    And there should be no page errors

  @corpus:journal
  Scenario: The filter is in a day's address, so a narrowed day is a link
    Given I open the day "2019-11-05"
    When I filter the page by "#home"
    Then the address is exactly "/d/2019-11-05?q=%23home"
    When I reload the page
    Then the filter box holds "#home"
    And the day lists "rails"

  @corpus:journal
  Scenario: A day's note is not part of the answer
    Given I open the day "2019-11-05"
    Then the day shows the note "Daily/2019/11/2019-11-05.md"
    When I filter the page by "#home"
    Then the day shows no note
    And the day lists "rails"
    When I clear the filter
    Then the day shows the note "Daily/2019/11/2019-11-05.md"
    And the day lists "ferry, posts, rails"

  @corpus:journal
  Scenario: A day that matched nothing says so in the bar, not on the page
    Given I open the day "2019-11-05"
    When I filter the page by "bathroom"
    Then the node "rails" is not shown
    And the node "ferry" is not shown
    And the filter found "No matches of 3"
    And the day does not say it is empty

  @corpus:journal
  Scenario: A tag in a row's own title filters the day it is drawn on
    Given I open the day "2019-11-05"
    When I press the tag "#home" in the row "rails"
    Then the address is exactly "/d/2019-11-05?q=%23home"
    And the day lists "rails"

  @corpus:journal
  Scenario: A tag inside an ancestry crumb still goes where the crumb goes
    Given I open the day "2019-11-05"
    When I press the tag "#home"
    Then the address is exactly "/work.olai#deck"

  @corpus:agenda
  Scenario: The agenda narrows day by day, and the silences close up
    When I open the agenda
    Then the filter box says "Filter" when empty
    And this page offers no Done flip
    And the spine's "late" rows are "permit, visas, posts"
    And the spine's "late" days are "2019-10-30, 2019-11-03, 2019-11-05"
    When I filter the page by "posts"
    Then the agenda spine runs "late, today"
    And the spine's "late" rows are "posts"
    And the spine's "late" days are "2019-11-05"
    And the filter found "1 of 3"
    And there should be no page errors

  @corpus:agenda
  Scenario: What is owed does not change because somebody typed in a box
    When I open the agenda
    Then the agenda entry is on fire with 3 late
    When I filter the page by "posts"
    Then the spine's "late" rows are "posts"
    And the agenda entry is on fire with 3 late

  @corpus:agenda
  Scenario: A line with nothing left on it is not drawn at all
    When I open the agenda
    When I filter the page by "nothing-is-called-this"
    Then the agenda draws no spine
    And the filter found "No matches of 3"
    And the agenda does not say it is empty

  @scratch:good
  Scenario: The trash is searched WITHIN, which is the rule it had to except
    Given I open the outline "house.olai"
    And I mark the page
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    And I open the Trash
    Then the Trash lists the node "hinges"
    When I filter the page by "hinges"
    Then the Trash lists the node "hinges"
    And the Trash does not list the node "handles"
    And the filter found "1 of 6"
    And the Trash row "hinges" is a match
    And the Trash row "install" is context
    And there should be no page errors
