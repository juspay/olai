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
    Given I open the outline "house.olai"
    And I show the done nodes
    Then the outline has 10 rows
    When I filter the page by "hinges"
    Then the outline has 3 rows
    And the node "kitchen" is shown
    And the node "install" is shown
    And the node "hinges" is shown
    And the node "handles" is not shown
    And the filter found "1 of 10"
    And the node "hinges" is a match
    And the node "kitchen" is context

  Scenario: A filtered page says WHY each row is drawn
    Given I open the outline "house.olai"
    When I filter the page by "alcove OR hinges"
    Then the outline has 4 rows
    And the filter found "2 of 10"
    And the node "hinges" is a match
    And the node "hinges" lights "hinges"
    And the node "kitchen" is context
    And the node "kitchen" lights nothing
    And the node "install" is context
    And the node "install" lights nothing
    And the node "order" is a match
    And the node "order" lights nothing
    And the node "order" excerpts "alcove"

  Scenario: A row found by its title needs no second line saying so
    Given I open the outline "house.olai"
    When I filter the page by "cabinets"
    Then the node "order" is a match
    And the node "order" lights "cabinets"
    And the node "order" draws no excerpt

  Scenario: The filter is part of the address, so it survives a reload
    Given I open the outline "house.olai"
    When I filter the page by "hinges"
    Then the address is exactly "/house.olai?q=hinges"
    When I reload the page
    Then the outline has 3 rows
    And the filter box holds "hinges"

  Scenario: Clearing the filter takes the query out of the address entirely
    Given I open the outline "house.olai"
    And I show the done nodes
    When I filter the page by "hinges"
    And I clear the filter
    Then the address is exactly "/house.olai"
    And the outline has 10 rows

  Scenario: A collapsed ancestor does not hide a match
    Given I open the outline "house.olai"
    When I collapse the node "install"
    Then the node "hinges" is not shown
    When I filter the page by "hinges"
    Then the node "hinges" is shown
    When I clear the filter
    Then the node "hinges" is not shown

  Scenario: The count line is measured against what the page holds, not what a preference left
    Given I open the outline "house.olai"
    Then the outline has 8 rows
    When I show the done nodes
    Then the outline has 10 rows
    When I hide the done nodes
    Then the outline has 8 rows
    When I filter the page by "hinges"
    Then the filter found "1 of 10"

  Scenario: Matches held back by the done preference are counted, and the reason is named
    Given I open the outline "house.olai"
    When I hide the done nodes
    And I filter the page by "hinges OR is:done"
    Then the node "hinges" is a match
    And the node "demo" is not shown
    And the filter found "1 of 10 — 2 more matches hidden as done"
    When I filter the page by "is:done"
    Then the outline has 0 rows
    And the filter found "No matches of 10 — 2 matches hidden as done"

  Scenario: The header's box refuses the same operator, in the same words
    Given I open the outline "house.olai"
    When I search the header for "is:open"
    Then the search refuses "is:open" and says "done, cancelled, doing, todo, marked, blocked, mirrored, trashed"

  Scenario: Pressing a `#tag` filters the page by it
    Given I open the outline "garden.olai"
    When I press the tag "#outdoors"
    Then the address is exactly "/garden.olai?q=%23outdoors"
    And the filter box holds "#outdoors"
    And the node "garden" is a match

  Scenario: Pressing a tag does not also put a caret in the row
    Given I open the outline "garden.olai"
    When I press the tag "#outdoors"
    Then no row is being edited

  Scenario: Zooming leaves the filter behind, and Back brings it home
    Given I open the outline "house.olai"
    When I filter the page by "cabinets"
    And I zoom into the node "install"
    Then the address is exactly "/zoom/#install"
    And the filter box holds ""
    When I go back
    Then the address is exactly "/house.olai?q=cabinets"

  Scenario: A zoomed page filters its own children
    Given I open the node "install"
    Then the outline has 3 rows
    When I filter the page by "is:todo"
    Then the outline has 2 rows
    And the node "handles" is not shown
    And the filter found "2 of 3"

  Scenario: There is no filter on the one page that cannot carry one
    Given I open the document "finishes.md"
    Then there is no filter bar

  Scenario: A tag is pressable exactly where the page can keep a filter
    Given I open the outline "house.olai"
    Then tags on this page are pressable
    When I open the day "2026-08-10"
    Then tags on this page are pressable

  Scenario: A filter cleared and typed into again narrows by the NEW query
    Given I open the outline "house.olai"
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

  Scenario: The empty box says Filter, and its grammar is a hint under it while focused
    Given I open the outline "house.olai"
    Then the filter box says "Filter" when empty
    And the filter hint is not shown
    When I focus the filter box
    Then the filter hint offers 'words | "a phrase" | a OR b | #tag | is:done | has:desc | date:last-week | changed:today | -not'
    And no row of the filter hint is chosen
    When I choose "#tag" from the filter hint
    Then the filter box holds "#tag"
    And the filter box has "tag" selected
    And the filter box has the focus
    And the filter hint is not shown
    When I type "home" into the filter box
    Then the filter box holds "#home"
    And the filter hint is not shown
    And there should be no page errors

  Scenario: The hint is walked by the arrows, taken by Enter, and put away by Escape
    Given I open the outline "house.olai"
    When I focus the filter box
    Then no row of the filter hint is chosen
    When I press "ArrowDown" in the filter box
    Then the filter hint's chosen row is "words"
    When I press "ArrowDown" in the filter box
    And I press "ArrowDown" in the filter box
    Then the filter hint's chosen row is "a OR b"
    When I press "ArrowUp" in the filter box
    Then the filter hint's chosen row is '"a phrase"'
    When I press "Escape" in the filter box
    Then the filter hint is not shown
    And the filter box has the focus
    And the filter box holds ""
    When I press "Tab" in the filter box
    And I focus the filter box
    Then the filter hint offers 'words | "a phrase" | a OR b | #tag | is:done | has:desc | date:last-week | changed:today | -not'
    When I press "ArrowUp" in the filter box
    Then the filter hint's chosen row is "-not"
    When I press "Enter" in the filter box
    Then the filter box holds "-not"
    And the filter box has "not" selected
    And the filter hint is not shown
    And the filter box has the focus
    And there should be no page errors

  Scenario: Clearing the box brings the hint back, and Escape in a filled box still empties it
    Given I open the outline "house.olai"
    When I filter the page by "hinges"
    Then the filter hint is not shown
    When I clear the filter
    Then the filter box holds ""
    When I focus the filter box
    Then the filter hint offers 'words | "a phrase" | a OR b | #tag | is:done | has:desc | date:last-week | changed:today | -not'
    When I type "hinges" into the filter box
    Then the filter hint is not shown
    When I press "Escape" in the filter box
    Then the filter box holds ""
    And the address is exactly "/house.olai"
    And there should be no page errors

  @phone
  Scenario: A thumb's filter box asks for a search keyboard, and typing in it still narrows
    Given I open the outline "house.olai"
    Then the filter box asks for a Search key and no corrections
    When I focus the filter box
    And I type "hinges" into the filter box
    Then the node "hinges" is shown
    And the node "handles" is not shown
    And there should be no page errors
