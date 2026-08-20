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
    # `rails` carries the tag; `ferry` is the other outline's whole answer for
    # this day, so filtering by the tag takes the heading with the row.
    Given I open the day "2019-11-05"
    Then the day groups are "life.olai, work.olai"
    And the day lists "ferry, posts, rails"
    When I filter the page by "#home"
    Then the day lists "rails"
    And the day groups are "work.olai"
    And the filter found "1 of 3"
    # Every row on a day is a MATCH: the ancestry that a tree would keep as
    # context is drawn in the crumb above the row, and was never a row.
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
    # A note is a DOCUMENT — prose, which is why a document is the one page whose
    # address takes no `?q=`. It can never be a match, so a filtered day draws the query's
    # answer and nothing else; clearing the box brings the day back whole.
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
    # "Nothing is on 2019-11-05" is a claim about the DAY; "no matches" is a
    # claim about the query. The page keeps its sentence for the first and lets
    # the bar make the second — the same division an empty outline keeps for
    # "write its first line".
    Given I open the day "2019-11-05"
    When I filter the page by "bathroom"
    Then the node "rails" is not shown
    And the node "ferry" is not shown
    And the filter found "no matches of 3"
    And the day does not say it is empty

  @corpus:journal
  Scenario: A day refuses an unknown value in the grammar's own words
    Given I open the day "2019-11-05"
    When I filter the page by "is:open"
    Then the filter refuses "is:open" and says "done, doing, todo, marked, blocked, mirrored, trashed"
    And the node "rails" is not shown

  @corpus:journal
  Scenario: A tag in a row's own title filters the day it is drawn on
    # The gesture the outline pages have had since the filter shipped, on a page
    # that could not keep a query until now. Same act, same address.
    Given I open the day "2019-11-05"
    When I press the tag "#home" in the row "rails"
    Then the address is exactly "/d/2019-11-05?q=%23home"
    And the day lists "rails"

  @corpus:journal
  Scenario: A tag inside an ancestry crumb still goes where the crumb goes
    # A crumb is a LINK, and the tag walk skips anchors — so one press is still
    # one act, and it is the navigation the link promises rather than a filter
    # the pill inside it might have suggested.
    Given I open the day "2019-11-05"
    When I press the tag "#home"
    Then the address is exactly "/#deck"

  @corpus:agenda
  Scenario: The agenda narrows day by day, and the silences close up
    When I open the agenda
    Then the spine's "late" rows are "permit, visas, posts"
    And the spine's "late" days are "2019-10-30, 2019-11-03, 2019-11-05"
    When I filter the page by "posts"
    # Two of the three days had nothing left on them, so they left the line —
    # a dot over no rows would be the page promising a day the query found
    # nothing on.
    Then the agenda spine runs "late, today"
    And the spine's "late" rows are "posts"
    And the spine's "late" days are "2019-11-05"
    And the filter found "1 of 3"
    And there should be no page errors

  @corpus:agenda
  Scenario: What is owed does not change because somebody typed in a box
    # The mark in the directory column counts the UNNARROWED reading: a filter is
    # a question about the open page, and what is late is a fact about the
    # directory. A count that moved with the box would be the one number in this
    # app that means something different depending on what is in a text field.
    When I open the agenda
    Then the agenda entry is on fire with 3 late
    When I filter the page by "posts"
    Then the spine's "late" rows are "posts"
    And the agenda entry is on fire with 3 late

  @corpus:agenda
  Scenario: The derived operator works on the page that is a derivation
    # `visas` waits on `photos`, which nobody has finished — the same reading
    # that dims the row and writes its `blocked by` line, asked on the page that
    # collects it.
    When I open the agenda
    When I filter the page by "is:blocked"
    Then the spine's "late" rows are "visas"
    And the filter found "1 of 3"
    And the node "visas" is blocked by "photos"

  @corpus:agenda
  Scenario: A line with nothing left on it is not drawn at all
    When I open the agenda
    When I filter the page by "nothing-is-called-this"
    # Not even the today dot: now is a place on a line, and a line with one dot
    # and nothing either side of it is a diagram of nothing.
    Then the agenda draws no spine
    And the filter found "no matches of 3"
    # ...and the page does not claim the agenda is empty, which is a different
    # thing and would be untrue.
    And the agenda does not say it is empty

  @scratch:good
  Scenario: The trash is searched WITHIN, which is the rule it had to except
    # Archived nodes are out of every reading unless a query says `is:trashed`
    # — because those doors are searching the directory. This page IS the
    # archive: a matcher applying that rule here would take away every row and
    # leave the reader nothing to read the absence by.
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
    # A pile is a TREE, so the scaffold above a match is kept as the context
    # that says where the pile came from — the outline page's rule, on the page
    # that is made of archives.
    And the Trash row "hinges" is a match
    And the Trash row "install" is context
    And there should be no page errors

  @scratch:good
  Scenario: An operator still means what it means on the page that is the archive
    Given I open the outline "house.olai"
    And I mark the page
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    And I open the Trash
    When I filter the page by "is:trashed"
    Then the Trash lists the node "hinges"
    And the filter found "6 of 6"
    # ...and its negation selects nothing here, which is the honest answer
    # rather than an empty page with no reason.
    When I filter the page by "-is:trashed"
    Then the Trash does not list the node "hinges"
    And the filter found "no matches of 6"
    # An archive narrowed to nothing is not "the Trash is empty" — that is a
    # claim about the archive, and this is a claim about the query.
    And the Trash does not say it is empty
