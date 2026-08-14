@corpus:good
Feature: Filtering the outline in place
  Workflowy's move, and the one the tags have been waiting for: a query does not
  open a list of results somewhere else — it takes rows AWAY from the outline in
  front of you, keeping every match and the ancestors that lead to it, so the
  thing you found is still standing where it lives.

  What decides which nodes match is `@olai/format`'s one matcher, which also
  gates an agent's `search_nodes` and the ⌘K palette (`filter.test.ts` holds the
  grammar). These scenarios are about the other half: what the page does with
  the answer, where the filter lives (the address), and what it says when it
  finds nothing.

  Scenario: A match is drawn with the ancestors that lead to it
    # The whole promise. `hinges` lives under `install`, which lives under
    # `kitchen`: all three stay, everything else goes, and the count says how
    # many of the rows on screen are actually matches.
    Given I open the outline "house.jsonl"
    Then the outline has 10 rows
    When I filter the page by "hinges"
    Then the outline has 3 rows
    And the node "kitchen" is shown
    And the node "install" is shown
    And the node "hinges" is shown
    And the node "handles" is not shown
    And the filter found "1 of 10"
    # Which of the three the query actually SELECTED, as a fact on the row —
    # the other two are the context that makes a bare title mean something.
    And the node "hinges" is a match
    And the node "kitchen" is context

  Scenario: The filter is part of the address, so it survives a reload
    # A narrowed page is a link somebody can send. That is the same argument
    # `/n/<id>` is made of, and it is why the filter is in the URL rather than
    # in a signal beside it.
    Given I open the outline "house.jsonl"
    When I filter the page by "hinges"
    Then the address is exactly "/o/house.jsonl?q=hinges"
    When I reload the page
    Then the outline has 3 rows
    And the filter box holds "hinges"

  Scenario: Clearing the filter takes the query out of the address entirely
    # An unfiltered page has ONE spelling — no `?q=`, no empty query — so one
    # page is one string in the bar.
    Given I open the outline "house.jsonl"
    When I filter the page by "hinges"
    And I clear the filter
    Then the address is exactly "/o/house.jsonl"
    And the outline has 10 rows

  Scenario: A collapsed ancestor does not hide a match
    # Folds are SUSPENDED while a filter is on. A fold is a claim about the
    # tree the reader was reading; the filter makes a different tree, and
    # honouring the collapse inside it would hide the very match that was typed
    # for. Nothing is written — clearing the filter brings the fold back.
    Given I open the outline "house.jsonl"
    When I collapse the node "install"
    Then the node "hinges" is not shown
    When I filter the page by "hinges"
    Then the node "hinges" is shown
    When I clear the filter
    Then the node "hinges" is not shown

  Scenario: `is:done` reads the mark a node stores
    # Never a derived one: `kitchen` has a finished child and carries `doing`
    # itself, so it is here as the ancestry rather than as a match. The second
    # match is `basil`, drawn under the MIRROR of `herbs` this outline holds —
    # a placement matches by the node it shows, wherever it is drawn.
    Given I open the outline "house.jsonl"
    When I filter the page by "is:done"
    Then the node "demo" is a match
    And the node "kitchen" is context
    And the filter found "2 of 10"

  Scenario: `has:desc` finds the node carrying a note
    Given I open the outline "house.jsonl"
    When I filter the page by "has:desc"
    Then the node "order" is a match
    And the filter found "1 of 10"

  Scenario: `date:` takes a day, and a range of them
    # The two dates a journal reads: `order` is scheduled for the 10th, `demo`
    # was finished on the 3rd. A dated `todo` is on no day, here as on the day
    # page, which is why `hinges` never turns up.
    Given I open the outline "house.jsonl"
    When I filter the page by "date:2026-08-10"
    Then the node "order" is a match
    And the filter found "1 of 10"
    When I filter the page by "date:2026-08-01..2026-08-31"
    Then the node "order" is a match
    And the node "demo" is a match
    And the node "hinges" is not shown
    And the filter found "2 of 10"

  Scenario: `-` takes a term or an operator back out
    Given I open the outline "house.jsonl"
    When I filter the page by "cabinets -is:doing"
    Then the node "install" is a match
    And the node "order" is not shown
    And the filter found "1 of 10"

  Scenario: A known operator with an unknown value is refused, not guessed at
    # The silent-error rule, in the one place a query language invites one: a
    # filter that quietly searched for the TEXT `is:blocked` would answer with
    # an empty page and no reason. The reader is told which values the operator
    # takes instead.
    Given I open the outline "house.jsonl"
    When I filter the page by "is:blocked"
    Then the filter refuses "is:blocked" and says "done, doing, todo, marked, archived"
    And the outline has 0 rows

  Scenario: A date no calendar could hold is refused too
    # `2026-13` is shape-clean and impossible, and it SORTS between December and
    # January — so swallowing it reads as a window rather than as nonsense. It
    # is the reader's mistake exactly as much as `date:soon` is.
    Given I open the outline "house.jsonl"
    When I filter the page by "date:2026-13"
    Then the filter refuses "date:2026-13" and says "2026-08-10"
    And the outline has 0 rows

  Scenario: The refusal quotes the reader, not the folded token
    # The words are matched case-folded; the refusal is quoted as TYPED. Telling
    # somebody who wrote `is:BLOCKED` that they wrote `is:blocked` is the
    # refusal misquoting the reader — the same defect class the refusal exists
    # to prevent, and the one none of the four doors had a scenario for.
    Given I open the outline "house.jsonl"
    When I filter the page by "is:BLOCKED"
    Then the filter refuses "is:BLOCKED" and says "done, doing, todo, marked, archived"
    # ...while a query that MATCHES still folds, so the two cannot be confused.
    When I filter the page by "IS:DONE"
    Then the node "demo" is a match

  Scenario: The header's box refuses the same operator, in the same words
    # One grammar, four doors. The filter parses for itself; the header box,
    # the ⌘K palette and an agent ask the server — and a door that answered
    # `is:blocked` with an empty list and no reason would be the one place a
    # typo looks exactly like an empty directory.
    Given I open the outline "house.jsonl"
    When I search the header for "is:blocked"
    Then the search refuses "is:blocked" and says "done, doing, todo, marked, archived"

  Scenario: The ⌘K palette refuses it too, in its own row
    # The third door. It reads the same `createNodeSearch` primitive the header
    # does, and draws the refusal in a row of its own — separate from the row
    # that says the CALL failed, because a refused call and a refused query are
    # two different pieces of news.
    Given I open the outline "house.jsonl"
    When I press the palette shortcut
    And I type "is:blocked" into the palette
    Then the search refuses "is:blocked" and says "done, doing, todo, marked, archived"

  Scenario: Pressing a `#tag` filters the page by it
    # The gesture the tags have been decorative for since title-markdown. It is
    # the same act as typing, so it lands in the same place: the address.
    Given I open the outline "garden.jsonl"
    When I press the tag "#outdoors"
    Then the address is exactly "/o/garden.jsonl?q=%23outdoors"
    And the filter box holds "#outdoors"
    And the node "garden" is a match

  Scenario: Pressing a tag does not also put a caret in the row
    # One press, one act. A tag pill sits inside the title, whose own click
    # opens the editor — and Solid runs the row's handler before the pane's, so
    # without a guard the press would filter the page AND start an edit.
    Given I open the outline "garden.jsonl"
    When I press the tag "#outdoors"
    Then no row is being edited

  Scenario: Zooming leaves the filter behind, and Back brings it home
    # A zoom is a navigation: it asks for that node's page, not for that node's
    # page still narrowed by what was typed on the last one. The filtered
    # address is not lost — it is where Back goes.
    Given I open the outline "house.jsonl"
    When I filter the page by "cabinets"
    And I zoom into the node "install"
    Then the address is exactly "/n/install"
    And the filter box holds ""
    When I go back
    Then the address is exactly "/o/house.jsonl?q=cabinets"

  Scenario: A zoomed page filters its own children
    # Scoped downstream, and it falls out of the address rather than being
    # implemented: the page decides its rows, the filter prunes them.
    Given I open the node "install"
    Then the outline has 3 rows
    When I filter the page by "is:todo"
    Then the outline has 2 rows
    And the node "handles" is not shown
    And the filter found "2 of 3"

  Scenario: There is no filter on a page that cannot carry one
    # A day is a query already, and its address spells a date rather than a
    # narrowing. Drawing a box there would promise something the URL has
    # nowhere to keep.
    Given I open the day "2026-08-10"
    Then there is no filter bar

  Scenario: A tag on a page that cannot be filtered is decoration, and looks it
    # Titles are drawn on pages with no filter to fill — a day, the agenda, a
    # document — and the pill is the same markup there. It must not look
    # pressable and then swallow the press: the pane says whether a tag in it
    # is live, the stylesheet draws the cursor on that, and the listener
    # declines on the same condition.
    #
    # On a day page the only tag is inside an ancestry crumb, which is a link —
    # so the press goes where the crumb goes, exactly as it did before tags
    # were pressable anywhere. What must NOT happen is a filter: the address
    # carries no `?q=`, here or on the page it lands on.
    Given I open the outline "house.jsonl"
    Then tags on this page are pressable
    When I open the day "2026-08-10"
    Then tags on this page are decoration
    When I press the tag "#home"
    Then the address is exactly "/n/kitchen"
