@scratch:chat
Feature: Measure retained transcript switches
  Scenario: Compare browser layout costs for a split with hundreds of chat rows
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    And I send "hello" from the plain node composer
    Then the node page conversation is ready for "install"
    When I ask the agent "benchmark-transcript"
    Then the agent is idle
    When I open every benchmark tool detail
    And I choose "Open in new tab" from the menu of the outline link "yard.olai"
    Then I measure both retained lane hiding strategies
    And there should be no page errors
