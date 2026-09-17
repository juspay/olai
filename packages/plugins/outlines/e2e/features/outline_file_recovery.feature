@scratch:good
Feature: An outline recovers after its file is externally removed and restored
  Background:
    Given I rewrite "recovery.olai" as:
      """
      {"id":"recovery","ord":"a0","title":"recovery outline"}
      {"id":"first","parent":"recovery","ord":"a0","title":"first task"}
      {"id":"second","parent":"recovery","ord":"a1","title":"second task"}
      """
    And I open the outline "recovery.olai"
    And I mark the page

  Scenario: A restored outline follows its new contents and can still be edited
    When I remove the served file "recovery.olai"
    Then the main pane says there is no outline "recovery.olai"
    When I rewrite "recovery.olai" as:
      """
      {"id":"recovery","ord":"a0","title":"recovery outline"}
      {"id":"first","parent":"recovery","ord":"a0","title":"restored first task"}
      {"id":"third","parent":"recovery","ord":"a1","title":"new third task"}
      """
    Then the outline "recovery.olai" shows exactly the nodes "recovery, first, third"
    And the node "first" has the title "restored first task"
    When I click the title of "third"
    And I select all and type "edited after restoration"
    And I press "Enter"
    Then "recovery.olai" holds a node titled "edited after restoration"
    And the page has not reloaded
    And there should be no page errors

  Scenario: An unfinished row survives an identical outline restoration
    When I click the title of "first"
    And I press "Enter"
    Then a new row is being typed
    When I remove the served file "recovery.olai"
    Then the main pane says there is no outline "recovery.olai"
    When I rewrite "recovery.olai" as:
      """
      {"id":"recovery","ord":"a0","title":"recovery outline"}
      {"id":"first","parent":"recovery","ord":"a0","title":"first task"}
      {"id":"second","parent":"recovery","ord":"a1","title":"second task"}
      """
    Then a new row is being typed
    When I click the first new row
    And I type "finish the restored draft"
    And I press "Enter"
    Then "recovery.olai" holds a node titled "finish the restored draft"
    And the node titled "finish the restored draft" comes before "second"
    And the page has not reloaded
    And there should be no page errors
