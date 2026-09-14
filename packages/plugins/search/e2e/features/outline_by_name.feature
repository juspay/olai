@scratch:good
Feature: An outline is findable by its file name
  Background:
    Given I rewrite "Home.olai" as:
      """
      {"id":"home-note","ord":"a0","title":"remember the address","desc":"home"}
      """
    And I open the outline "house.olai"

  Scenario: The outline name outranks a note mentioning it and opens the outline
    When I press the palette shortcut
    And I type "Home" into the palette
    Then the "palette-item" result "Home" has place "Home.olai"
    And the outline hit "Home.olai" ranks before node "home-note"
    When I point the palette at outline "Home.olai"
    And I press "Enter"
    Then the sidebar marks the outline "Home.olai" as the one open
    And there should be no page errors

  Scenario: Internal outlines are never filename hits
    When I press the palette shortcut
    And I type "_olai/Pins.olai" into the palette
    Then the palette lists no document "_olai/Pins.olai"
    And there should be no page errors

  Scenario: An agent asking for nodes excludes the matching outline file
    Given a terminal agent is connected to the served directory
    When the terminal agent searches for "Home" with kind "node"
    Then every terminal search hit is a node and includes "home-note"
