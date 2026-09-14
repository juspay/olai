@scratch:good
Feature: Search results follow external edits while the query stays open
  Scenario: The palette drops a removed target and opens the new matching node
    Given I rewrite "search-live.olai" as:
      """
      {"id":"old-target","ord":"a0","title":"orchid original task"}
      {"id":"new-target","ord":"a1","title":"another task"}
      """
    And I open the outline "house.olai"
    And I mark the page
    When I press the palette shortcut
    And I type "orchid" into the palette
    Then the palette lists the node "orchid original task"
    When I rewrite "search-live.olai" as:
      """
      {"id":"new-target","ord":"a0","title":"orchid replacement task"}
      """
    Then the palette lists the node "orchid replacement task"
    And the palette lists no node with id "old-target"
    When I choose "orchid replacement task" from the palette
    Then the zoomed node is "new-target"
    When I click the outline "search-live.olai"
    And I click the title of "new-target"
    And I select all and type "edited from the live result"
    And I press "Enter"
    Then "search-live.olai" holds a node titled "edited from the live result"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The header search drops a removed target and opens the new matching node
    Given I rewrite "search-live.olai" as:
      """
      {"id":"old-target","ord":"a0","title":"orchid original task"}
      {"id":"new-target","ord":"a1","title":"another task"}
      """
    And I open the outline "house.olai"
    And I mark the page
    When I search the header for "orchid"
    Then the header search lists the node "orchid original task"
    When I rewrite "search-live.olai" as:
      """
      {"id":"new-target","ord":"a0","title":"orchid replacement task"}
      """
    Then the header search lists the node "orchid replacement task"
    And the header search does not list the node "orchid original task"
    When I press the header search result "orchid replacement task"
    Then the zoomed node is "new-target"
    When I click the outline "search-live.olai"
    And I click the title of "new-target"
    And I select all and type "edited from the live result"
    And I press "Enter"
    Then "search-live.olai" holds a node titled "edited from the live result"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A live shortlist updates its total when a capped answer becomes one result
    Given I rewrite "search-count.olai" as:
      """
      {"id":"match-0","ord":"a0","title":"clematis task 0"}
      {"id":"match-1","ord":"a1","title":"clematis task 1"}
      {"id":"match-2","ord":"a2","title":"clematis task 2"}
      {"id":"match-3","ord":"a3","title":"clematis task 3"}
      {"id":"match-4","ord":"a4","title":"clematis task 4"}
      {"id":"match-5","ord":"a5","title":"clematis task 5"}
      {"id":"match-6","ord":"a6","title":"clematis task 6"}
      {"id":"match-7","ord":"a7","title":"clematis task 7"}
      {"id":"match-8","ord":"a8","title":"clematis task 8"}
      {"id":"match-9","ord":"a9","title":"clematis task 9"}
      """
    And I open the outline "house.olai"
    When I press the palette shortcut
    And I type "clematis" into the palette
    Then the palette found "8 of 10 matches"
    When I rewrite "search-count.olai" as:
      """
      {"id":"match-0","ord":"a0","title":"clematis only survivor"}
      """
    Then the palette lists the node "clematis only survivor"
    And the palette says nothing about a total
    And the palette lists no node with id "match-1"
    When I choose "clematis only survivor" from the palette
    Then the zoomed node is "match-0"
    And there should be no page errors

  Scenario: An open palette search refreshes matches after a network outage
    Given I rewrite "search-live.olai" as:
      """
      {"id":"old-target","ord":"a0","title":"orchid before outage"}
      """
    And I open the outline "house.olai"
    And I mark the page
    When I press the palette shortcut
    And I type "orchid" into the palette
    Then the palette lists the node "orchid before outage"
    When the browser goes offline
    Then the connection is "reconnecting"
    When I rewrite "search-live.olai" as:
      """
      {"id":"new-target","ord":"a0","title":"orchid after outage"}
      """
    And the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    And the palette lists the node "orchid after outage"
    And the palette lists no node with id "old-target"
    When I choose "orchid after outage" from the palette
    Then the zoomed node is "new-target"
    And the page has not reloaded
