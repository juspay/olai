@share-scratch
Feature: What is put away is on the Trash and nowhere else
  Moving a row to the Trash used to change where it was READ and not whether it
  was read: an archived node kept its dates, so it went on lighting its day in
  the calendar, sat on that day's page under an `_olai/Trash.olai` heading, and — if
  somebody had scheduled it and never finished it — went on being owed on the
  agenda. That was a deliberate rule (2026-08-11: work that was put away is
  still work that happened) and the human reversed it on 2026-08-17 after
  meeting it: putting something away is saying you are done looking at it, and a
  page that keeps handing it back is arguing with the person who put it there.

  So the rule is one PAGE — and pointedly not one door, because the doors are
  the four ways to search and every one of them still reaches the archive when
  a query names it. **The Trash draws what was archived; no other page does** —
  not a day, not the calendar's dots, not the agenda, not the count beside it in
  the sidebar. Nothing on disk moves for that: the record keeps its dates and
  its mark, Put back returns it to its days along with its outline, and
  `is:trashed` reaches it from every search box in the meantime. What was taken
  away is the DEFAULT presence, never the way to ask.

  These scenarios are that rule read once per page, over the vault the rest of
  the suite writes to: `order the new cabinets` is dated the 10th of August and
  is the one overdue thing in it, `take out the old counters` is the only thing
  finished on the 3rd, and both of them go to the Trash by the same menu verb a
  person uses. They share one copy per worker (`@share-scratch`); the corpus
  is restored between scenarios.

  @scratch:good
  Scenario: A task put away is owed nowhere, and the mark beside the page agrees
    # `order` is doing, dated the 10th, and nothing has finished it: the one
    # thing this vault is late on.
    Given I open the agenda
    Then the spine's "late" rows are "order"
    And the agenda entry is on fire with 1 late
    When I open the outline "house.olai"
    And I open the node menu of "order"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    And I open the agenda
    # "Nothing is due." — the page's own sentence, because there is nothing
    # owed rather than nothing matching.
    Then the agenda is empty
    And the agenda does not list "order"
    # The count is the page's own rows counted (`owedOf`), so it cannot be left
    # saying one thing is late over a page drawing none.
    And the agenda entry is quiet
    And there should be no page errors

  @scratch:good
  Scenario: A row put away leaves the day it was scheduled for
    Given I open the day "2026-08-10"
    # Two outlines have something on the 10th, in path order.
    Then the day groups are "Daily/2026-08.olai, house.olai"
    And the day lists "catch-up, order"
    When I open the outline "house.olai"
    And I open the node menu of "order"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    And I open the day "2026-08-10"
    # The row goes, and the outline heading that held only it goes with it —
    # the day's own rule for an outline left with nothing, reached here by the
    # archive rather than by a query.
    Then the day lists "catch-up"
    And the day groups are "Daily/2026-08.olai"
    And there should be no page errors

  @scratch:good
  Scenario: The dot under a day goes out with the last row on it
    # A dot and the day it opens are one reading (`@olai/format`'s `dates.ts`),
    # so the rule cannot reach the page and miss the calendar. The 3rd holds
    # one finished node and nothing else.
    Given I open the day "2026-08-03"
    Then the month shown is "2026-08"
    And the day lists "demo"
    And the day "2026-08-03" has something on it
    When I open the outline "house.olai"
    And I open the node menu of "demo"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    And I open the day "2026-08-03"
    Then the day is empty
    And the day "2026-08-03" has nothing on it
    And there should be no page errors

  @scratch:good
  Scenario: The Trash is where it went, and `is:trashed` still reaches it
    # The other half of the ruling: what went is the DEFAULT presence, never the
    # way to ask. How the Trash lists a pile is `trash.feature`'s, and how a
    # query searches within it is `filter_everywhere.feature`'s — what is this
    # feature's is that the row is THERE while it is nowhere else, and that the
    # operator naming the archive still answers from a page drawing none of it.
    Given I open the outline "house.olai"
    When I open the node menu of "order"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    And I open the Trash
    Then the Trash lists the node "order"
    When I open the day "2026-08-10"
    Then the day lists "catch-up"
    # On the day itself there is nothing archived to find — the page draws none
    # of it, and a filter narrows the page rather than re-asking its question.
    When I filter the page by "is:trashed"
    Then the filter found "no matches of 1"
    When I clear the filter
    And I press the palette shortcut
    And I type "is:trashed" into the palette
    Then the palette lists the node "order the new cabinets"
    And there should be no page errors
