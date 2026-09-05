@scratch:good
Feature: An open node permalink follows removal and relocation
  Background:
    Given I rewrite "source.olai" as:
      """
      {"id":"source-root","ord":"a0","title":"original parent"}
      {"id":"traveller","parent":"source-root","ord":"a0","title":"travelling branch"}
      {"id":"traveller-child","parent":"traveller","ord":"a0","title":"original child"}
      """
    And I open the node "traveller"
    And I mark the page
    Then the breadcrumbs are "source.olai, original parent"

  Scenario: Restoring a removed node repairs its open permalink and permits editing
    When I rewrite "source.olai" as:
      """
      {"id":"source-root","ord":"a0","title":"original parent"}
      """
    Then a not-found is shown
    And the address is "/#traveller"
    When I rewrite "source.olai" as:
      """
      {"id":"source-root","ord":"a0","title":"restored parent"}
      {"id":"traveller","parent":"source-root","ord":"a0","title":"restored branch"}
      {"id":"restored-child","parent":"traveller","ord":"a0","title":"restored child"}
      """
    Then the zoomed node is "traveller"
    And the node "restored-child" is shown
    And the node "traveller-child" is not shown
    And the breadcrumbs are "source.olai, restored parent"
    When I click the title of "restored-child"
    And I select all and type "edited restored child"
    And I press "Enter"
    Then "source.olai" holds a node titled "edited restored child"
    And the address is "/#traveller"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Relocation keeps the permalink and updates its canonical breadcrumb destination
    When I remove the served file "source.olai"
    Then a not-found is shown
    When I rewrite "destination.olai" as:
      """
      {"id":"destination-root","ord":"a0","title":"new parent"}
      {"id":"traveller","parent":"destination-root","ord":"a0","title":"travelling branch"}
      {"id":"traveller-child","parent":"traveller","ord":"a0","title":"relocated child"}
      """
    Then the zoomed node is "traveller"
    And the node "traveller-child" has the title "relocated child"
    And the breadcrumbs are "destination.olai, new parent"
    And the address is "/#traveller"
    When I follow the breadcrumb "destination.olai"
    Then the address is "/destination.olai"
    And the node "traveller" is shown
    When I go back
    Then the zoomed node is "traveller"
    And the breadcrumbs are "destination.olai, new parent"
    When I click the title of "traveller-child"
    And I select all and type "edited in destination"
    And I press "Enter"
    Then "destination.olai" holds a node titled "edited in destination"
    And the page has not reloaded
    And there should be no page errors
