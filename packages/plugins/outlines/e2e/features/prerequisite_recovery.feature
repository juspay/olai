@scratch:good
Feature: Prerequisites remain usable when their target changes live
  Background:
    Given I rewrite "dependent.olai" as:
      """
      {"id":"dependent","ord":"a0","title":"dependent work","todo":"2026-08-11","after":["prerequisite"]}
      """
    And I rewrite "prerequisite.olai" as:
      """
      {"id":"prerequisite","ord":"a0","title":"original prerequisite","todo":"2026-08-11"}
      """
    And I open the node "dependent"
    And I mark the page
    Then the node "dependent" is blocked by exactly "prerequisite"
    And the node "dependent" comes after "original prerequisite"

  Scenario: A renamed prerequisite updates its link and completing it clears the dependent
    When I rewrite "prerequisite.olai" as:
      """
      {"id":"prerequisite","ord":"a0","title":"renamed prerequisite","todo":"2026-08-11"}
      """
    Then the node "dependent" comes after "renamed prerequisite"
    When I follow the blocked link to "prerequisite" on "dependent"
    Then the zoomed node is "prerequisite"
    And the breadcrumbs are "prerequisite.olai"
    When I click the outline "prerequisite.olai"
    And I click the title of "prerequisite"
    And I press "Control+Enter"
    Then "prerequisite.olai" holds a node marked done titled "renamed prerequisite"
    When I go back
    And I go back
    Then the zoomed node is "dependent"
    And the node "dependent" is not blocked
    And the node "dependent" comes after "renamed prerequisite"
    When I click the outline "dependent.olai"
    And I click the title of "dependent"
    And I press "Control+Enter"
    Then "dependent.olai" holds a node marked done titled "dependent work"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A prerequisite relocated to another file keeps its blocker link usable
    When I remove the served file "prerequisite.olai"
    And I rewrite "relocated.olai" as:
      """
      {"id":"prerequisite","ord":"a0","title":"relocated prerequisite","todo":"2026-08-11"}
      """
    Then the node "dependent" comes after "relocated prerequisite"
    And the node "dependent" is blocked by exactly "prerequisite"
    When I follow the blocked link to "prerequisite" on "dependent"
    Then the zoomed node is "prerequisite"
    And the breadcrumbs are "relocated.olai"
    When I click the outline "relocated.olai"
    And I click the title of "prerequisite"
    And I press "Alt+Enter"
    Then "relocated.olai" holds a node marked cancelled titled "relocated prerequisite"
    When I go back
    And I go back
    Then the zoomed node is "dependent"
    And the node "dependent" is not blocked
    And the node "dependent" comes after "relocated prerequisite"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A rebuilt page follows the current prerequisite and allows removing the dependency
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the node "dependent" is blocked by exactly "prerequisite"
    When I follow the blocked link to "prerequisite" on "dependent"
    Then the zoomed node is "prerequisite"
    When I go back
    Then the zoomed node is "dependent"
    When I drop "prerequisite" from the drawn "after" of "dependent"
    Then "dependent.olai" holds the node "dependent" after nothing
    And the node "dependent" is not blocked
    When I press "ControlOrMeta+z"
    Then "dependent.olai" holds the node "dependent" after "prerequisite"
    And the node "dependent" is blocked by exactly "prerequisite"
    And the page has not reloaded
    And there should be no page errors
