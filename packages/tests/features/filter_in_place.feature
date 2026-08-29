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
    Given I open the outline "house.olai"
    # The page hides its finished rows by default now; the counts here are the
    # WHOLE page's, so it is first asked to show them.
    And I show the done nodes
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

  Scenario: A filtered page says WHY each row is drawn
    # The whole of the 2026-08-18 ruling, on one page: every row here was
    # already CORRECT before it and the page was still confusing, because
    # nothing said why any given row was in front of the reader. Three cases,
    # and this one query draws all three at once.
    #
    # `alcove` is a word in `order`'s NOTE and nowhere in its title; `hinges`
    # is a word in the title of `hinges`. `kitchen` and `install` carry
    # neither and are here only as the ancestry that leads to the two matches.
    Given I open the outline "house.olai"
    When I filter the page by "alcove OR hinges"
    Then the outline has 4 rows
    And the filter found "2 of 10"
    # 1. THE MATCH SHOWS ITS NEEDLE — where in the title the query landed,
    #    which is the reader's own answer to use-versus-mention.
    And the node "hinges" is a match
    And the node "hinges" lights "hinges"
    # 2. A KEPT ANCESTOR IS NOT A MATCH, and now says so in ink as well as in
    #    `data-match`: nothing of the query is in either title, so nothing
    #    lights up in them.
    And the node "kitchen" is context
    And the node "kitchen" lights nothing
    And the node "install" is context
    And the node "install" lights nothing
    # 3. A NOTE-ONLY MATCH DRAWS ITS REASON — one clamped line of the note
    #    around the hit, because the title holds nothing the reader typed.
    And the node "order" is a match
    And the node "order" lights nothing
    And the node "order" excerpts "alcove"

  Scenario: A row found by its title needs no second line saying so
    # The excerpt is drawn for the row whose title says NOTHING of the query,
    # and only that row — a note repeating what the title already lit would be
    # noise on a page whose whole problem was too little signal. `order` is
    # the one node here carrying a note, and `cabinets` is in its title.
    Given I open the outline "house.olai"
    When I filter the page by "cabinets"
    Then the node "order" is a match
    And the node "order" lights "cabinets"
    And the node "order" draws no excerpt

  Scenario: The filter is part of the address, so it survives a reload
    # A narrowed page is a link somebody can send. That is the same argument
    # `/#<id>` is made of, and it is why the filter is in the URL rather than
    # in a signal beside it.
    Given I open the outline "house.olai"
    When I filter the page by "hinges"
    Then the address is exactly "/house.olai?q=hinges"
    When I reload the page
    Then the outline has 3 rows
    And the filter box holds "hinges"

  Scenario: Clearing the filter takes the query out of the address entirely
    # An unfiltered page has ONE spelling — no `?q=`, no empty query — so one
    # page is one string in the bar.
    Given I open the outline "house.olai"
    And I show the done nodes
    When I filter the page by "hinges"
    And I clear the filter
    Then the address is exactly "/house.olai"
    And the outline has 10 rows

  Scenario: A collapsed ancestor does not hide a match
    # Folds are SUSPENDED while a filter is on. A fold is a claim about the
    # tree the reader was reading; the filter makes a different tree, and
    # honouring the collapse inside it would hide the very match that was typed
    # for. Nothing is written — clearing the filter brings the fold back.
    Given I open the outline "house.olai"
    When I collapse the node "install"
    Then the node "hinges" is not shown
    When I filter the page by "hinges"
    Then the node "hinges" is shown
    When I clear the filter
    Then the node "hinges" is not shown

  Scenario: The count line is measured against what the page holds, not what a preference left
    # THE DENOMINATOR, on the page where NOTHING is being held back — which is
    # the case the scenario below cannot show. `hinges` matches one open row
    # and neither finished one, so the line is the count and NOTHING ELSE: the
    # page draws eight rows, the line says ten, and ten is what the page HOLDS.
    # It used to be the rows that were left, which is where the arithmetic
    # broke the moment a match was held back as well.
    #
    # The reading is EXACT here, and that is half of what this scenario is for:
    # asked as a substring it would go green against a bar that had appended a
    # clause about matches nothing is holding back (review of #248, both
    # reviewers). One element, one sentence, one comparison.
    Given I open the outline "house.olai"
    # `demo` and `basil` are finished, and the tree is two rows shorter for it —
    # the per-page default is hidden, so the walk starts where the pick ends up.
    Then the outline has 8 rows
    When I show the done nodes
    Then the outline has 10 rows
    When I hide the done nodes
    Then the outline has 8 rows
    When I filter the page by "hinges"
    Then the filter found "1 of 10"

  Scenario: Matches held back by the done preference are counted, and the reason is named
    # The sentence this whole line exists for: a query that found three things
    # on a page drawing one of them says so, says why the other two are not
    # there, and says where the switch is. `hinges` is open work; `demo` and
    # `basil` are the finished ones, and `basil` is a match under the MIRROR of
    # the herb bed, which is a row of this page like any other.
    Given I open the outline "house.olai"
    When I hide the done nodes
    And I filter the page by "hinges OR is:done"
    Then the node "hinges" is a match
    And the node "demo" is not shown
    And the filter found "1 of 10 — 2 more matches hidden as done (Prefs)"
    # ...and with nothing drawn at all, the same three truths minus the word
    # `more`, which would be more than the nothing on screen. This is `is:done`
    # typed by somebody who hides finished work — the page that must never look
    # like an empty directory.
    When I filter the page by "is:done"
    Then the outline has 0 rows
    And the filter found "no matches of 10 — 2 matches hidden as done (Prefs)"

  Scenario: The header's box refuses the same operator, in the same words
    # One grammar, four doors. The filter parses for itself; the header box,
    # the ⌘K palette and an agent ask the server — and a door that answered
    # `is:open` with an empty list and no reason would be the one place a
    # typo looks exactly like an empty directory.
    Given I open the outline "house.olai"
    When I search the header for "is:open"
    Then the search refuses "is:open" and says "done, cancelled, doing, todo, marked, blocked, mirrored, trashed"

  Scenario: Pressing a `#tag` filters the page by it
    # The gesture the tags have been decorative for since title-markdown. It is
    # the same act as typing, so it lands in the same place: the address.
    Given I open the outline "garden.olai"
    When I press the tag "#outdoors"
    Then the address is exactly "/garden.olai?q=%23outdoors"
    And the filter box holds "#outdoors"
    And the node "garden" is a match

  Scenario: Pressing a tag does not also put a caret in the row
    # One press, one act. A tag pill sits inside the title, whose own click
    # opens the editor — and Solid runs the row's handler before the pane's, so
    # without a guard the press would filter the page AND start an edit.
    Given I open the outline "garden.olai"
    When I press the tag "#outdoors"
    Then no row is being edited

  Scenario: Zooming leaves the filter behind, and Back brings it home
    # A zoom is a navigation: it asks for that node's page, not for that node's
    # page still narrowed by what was typed on the last one. The filtered
    # address is not lost — it is where Back goes.
    Given I open the outline "house.olai"
    When I filter the page by "cabinets"
    And I zoom into the node "install"
    Then the address is exactly "/#install"
    And the filter box holds ""
    When I go back
    Then the address is exactly "/house.olai?q=cabinets"

  Scenario: A zoomed page filters its own children
    # Scoped downstream, and it falls out of the address rather than being
    # implemented: the page decides its rows, the filter prunes them.
    Given I open the node "install"
    Then the outline has 3 rows
    When I filter the page by "is:todo"
    Then the outline has 2 rows
    And the node "handles" is not shown
    And the filter found "2 of 3"

  Scenario: There is no filter on the one page that cannot carry one
    # A document is PROSE, and this grammar selects nodes — so a document is the
    # one page with no `?q=` on its address, and drawing a box there would promise
    # something neither the URL nor the matcher has anywhere to put. Every other
    # page draws one (`filter_everywhere.feature`).
    Given I open the document "finishes.md"
    Then there is no filter bar

  Scenario: A tag is pressable exactly where the page can keep a filter
    # The pane says whether a tag in it is live, the stylesheet draws the cursor
    # on that fact, and the listener declines on the same condition — so a pill
    # never looks pressable and then swallows the press. That claim used to have
    # a second half about the pages with no filter to fill; the pages have one
    # now, and where the press lands on each of them is
    # `filter_everywhere.feature`.
    Given I open the outline "house.olai"
    Then tags on this page are pressable
    When I open the day "2026-08-10"
    Then tags on this page are pressable

  Scenario: A filter cleared and typed into again narrows by the NEW query
    # The answer to a query belongs to the SESSION it was asked in. Between the
    # keystroke that settles and the frame that answers it, the rows on screen
    # hold still — which is honest between two queries somebody is typing
    # through, and a lie across a CLEAR: the page went back to whole, and the
    # last session's answer standing on it would prune rows by a question
    # nobody is asking any more.
    #
    # `handles` is the whole claim: `hinges` did not select it, `handles` does,
    # and the page was drawing it when the second query was typed. If the first
    # session's answer is spent on the second, it goes away and comes back
    # (`@olai/web`'s `filter/asking.ts`, where the hold is a session).
    Given I open the outline "house.olai"
    # Shown rather than left at the per-page default: this one is about the
    # answer across a CLEAR, and a page that is hiding two rows counts eight
    # where it is about to count them again.
    And I show the done nodes
    When I filter the page by "hinges"
    Then the outline has 3 rows
    And the node "handles" is not shown
    When I clear the filter
    Then the outline has 10 rows
    And the node "handles" is shown
    And I mark the screen
    When I filter the page by "handles"
    Then the outline has 3 rows
    And the node "handles" is a match
    And the node "hinges" is not shown
    And the node "handles" was never taken away
