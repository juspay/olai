@scratch:good
Feature: An open filter follows changing matches without losing its query
  Background:
    Given I rewrite "filtered.olai" as:
      """
      {"id":"filter-root","ord":"a0","title":"work"}
      {"id":"filter-first","parent":"filter-root","ord":"a0","title":"needle first"}
      {"id":"filter-second","parent":"filter-root","ord":"a1","title":"other work"}
      """
    And I open the outline "filtered.olai"
    And I mark the page
    When I filter the page by "needle"
    Then the node "filter-first" is a match
    And the node "filter-second" is not shown

  Scenario: Replacing a match updates membership and editing the new match updates it again
    When I rewrite "filtered.olai" as:
      """
      {"id":"filter-root","ord":"a0","title":"work"}
      {"id":"filter-first","parent":"filter-root","ord":"a0","title":"first no longer matches"}
      {"id":"filter-second","parent":"filter-root","ord":"a1","title":"needle second"}
      """
    Then the node "filter-first" is not shown
    And the node "filter-second" is a match
    And the filter box holds "needle"
    When I click the title of "filter-second"
    And I select all and type "finished searching"
    And I press "Enter"
    And I press "Escape"
    Then "filtered.olai" holds a node titled "finished searching"
    And the node "filter-second" is not shown
    And the filter found "no matches of 3"
    When I clear the filter
    Then the node titled "first no longer matches" is shown
    And the node titled "finished searching" is shown
    And the page has not reloaded
    And there should be no page errors

  Scenario: A no-match filter survives rebuilding and discovers a later match
    When I filter the page by "later"
    Then the filter found "no matches of 3"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the filter box holds "later"
    And the filter found "no matches of 3"
    When I rewrite "filtered.olai" as:
      """
      {"id":"filter-root","ord":"a0","title":"work"}
      {"id":"filter-first","parent":"filter-root","ord":"a0","title":"needle first"}
      {"id":"filter-second","parent":"filter-root","ord":"a1","title":"later arrival"}
      """
    Then the node "filter-second" is a match
    And the node "filter-root" is context
    And the filter found "1 of 3"
    When I click the title of "filter-second"
    And I select all and type "later edited"
    And I press "Enter"
    And I press "Escape"
    Then "filtered.olai" holds a node titled "later edited"
    And the node "filter-second" is a match
    And the filter box holds "later"
    And the page has not reloaded
    And there should be no page errors
