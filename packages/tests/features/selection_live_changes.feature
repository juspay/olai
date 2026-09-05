@scratch:good
Feature: Bulk selections follow the rows that remain on the page
  Background:
    Given I rewrite "selected.olai" as:
      """
      {"id":"selection-root","ord":"a0","title":"selected work"}
      {"id":"selection-a","parent":"selection-root","ord":"a0","title":"first task","todo":"2026-08-11"}
      {"id":"selection-b","parent":"selection-root","ord":"a1","title":"second task","todo":"2026-08-11"}
      {"id":"selection-c","parent":"selection-root","ord":"a2","title":"untouched task","todo":"2026-08-11"}
      """
    And I open the outline "selected.olai"
    And I show the done nodes
    And I mark the page
    When I pick the title of "selection-a"
    And I pick the title of "selection-b"
    Then 2 rows are picked

  Scenario: A removed selected row is dropped before completing the remaining selection
    When I rewrite "selected.olai" as:
      """
      {"id":"selection-root","ord":"a0","title":"selected work"}
      {"id":"selection-b","parent":"selection-root","ord":"a1","title":"second task","todo":"2026-08-11"}
      {"id":"selection-c","parent":"selection-root","ord":"a2","title":"untouched task","todo":"2026-08-11"}
      """
    Then the node "selection-a" is not shown
    And 1 rows are picked
    And the row "selection-b" is picked
    And the row "selection-c" is not picked
    When I press "Control+Enter"
    Then the node "selection-b" has status "done"
    And the node "selection-c" has status "todo"
    And "selected.olai" holds a node marked done titled "second task"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A selected row moved under another parent stays selected without selecting its new parent
    When I rewrite "selected.olai" as:
      """
      {"id":"selection-root","ord":"a0","title":"selected work"}
      {"id":"selection-a","parent":"selection-root","ord":"a0","title":"first task","todo":"2026-08-11"}
      {"id":"selection-c","parent":"selection-root","ord":"a2","title":"untouched task","todo":"2026-08-11"}
      {"id":"selection-b","parent":"selection-c","ord":"a0","title":"second task","todo":"2026-08-11"}
      """
    Then the node "selection-b" is a child of "selection-c"
    And 2 rows are picked
    And the row "selection-a" is picked
    And the row "selection-b" is picked
    And the row "selection-c" is not picked
    When I press "Control+Enter"
    Then the node "selection-a" has status "done"
    And the node "selection-b" has status "done"
    And the node "selection-c" has status "todo"
    And "selected.olai" holds a node marked done titled "first task"
    And "selected.olai" holds a node marked done titled "second task"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Restoring a removed row does not silently select it again
    When I rewrite "selected.olai" as:
      """
      {"id":"selection-root","ord":"a0","title":"selected work"}
      {"id":"selection-c","parent":"selection-root","ord":"a2","title":"untouched task","todo":"2026-08-11"}
      """
    Then no rows are picked
    When I rewrite "selected.olai" as:
      """
      {"id":"selection-root","ord":"a0","title":"selected work"}
      {"id":"selection-a","parent":"selection-root","ord":"a0","title":"restored first task","todo":"2026-08-11"}
      {"id":"selection-c","parent":"selection-root","ord":"a2","title":"untouched task","todo":"2026-08-11"}
      """
    Then the node titled "restored first task" is shown
    And no rows are picked
    When I pick the title of "selection-c"
    Then 1 rows are picked
    And the row "selection-a" is not picked
    When I press "Control+Enter"
    Then the node "selection-c" has status "done"
    And the node "selection-a" has status "todo"
    And "selected.olai" holds a node marked done titled "untouched task"
    And the page has not reloaded
    And there should be no page errors
