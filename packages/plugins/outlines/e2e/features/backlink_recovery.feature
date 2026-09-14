@scratch:good
Feature: Backlink navigation follows replacement sources
  Background:
    Given I rewrite "target.olai" as:
      """
      {"id":"backlink-target","ord":"a0","title":"the target"}
      """
    And I rewrite "source.olai" as:
      """
      {"id":"backlink-source","ord":"a0","title":"original source","see":["backlink-target"]}
      """
    And I open the node "backlink-target"
    And I mark the page
    When I open the referenced-by section
    Then the referenced-by "sees this" row reads "original source"

  Scenario: Replacing the reference kind updates the open list even when its count is unchanged
    When I rewrite "source.olai" as:
      """
      {"id":"backlink-source","ord":"a0","title":"a mention of @backlink-target"}
      """
    Then the page says it is referenced by 1 nodes
    And the referenced-by "mentions this" row reads "a mention of @backlink-target"
    And the referenced-by section draws no "sees this" row
    When I follow the referenced-by link to "backlink-source"
    Then the zoomed node is "backlink-source"
    And the breadcrumbs are "source.olai"
    When I go back
    Then the zoomed node is "backlink-target"
    And the page says it is referenced by 1 nodes
    And the page has not reloaded
    And there should be no page errors

  Scenario: A removed source can return in a different outline with a working backlink
    When I remove the served file "source.olai"
    Then the page draws no referenced-by section
    When I rewrite "replacement.olai" as:
      """
      {"id":"replacement-root","ord":"a0","title":"replacement outline"}
      {"id":"backlink-source","parent":"replacement-root","ord":"a0","title":"relocated source","see":["backlink-target"]}
      {"id":"source-child","parent":"backlink-source","ord":"a0","title":"source work"}
      """
    Then the page says it is referenced by 1 nodes
    When I open the referenced-by section
    Then the referenced-by "sees this" row reads "relocated source"
    When I follow the referenced-by link to "backlink-source"
    Then the zoomed node is "backlink-source"
    And the breadcrumbs are "replacement.olai, replacement outline"
    When I click the title of "source-child"
    And I select all and type "edited through the restored backlink"
    And I press "Enter"
    Then "replacement.olai" holds a node titled "edited through the restored backlink"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A plugin rebuild keeps the backlink section open on the same node
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the referenced-by section is still open
    And the referenced-by "sees this" row reads "original source"
    When I follow the referenced-by link to "backlink-source"
    Then the zoomed node is "backlink-source"
    When I go back
    Then the zoomed node is "backlink-target"
    And the referenced-by section is collapsed
    And the page has not reloaded
    And there should be no page errors
