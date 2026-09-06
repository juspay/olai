@scratch:good
@extra-plugins:test-layout
@without-plugins:layout
Feature: Content runs under an independent layout
  The maintained fixture only consumes the navigation outlet and renderer
  contracts. Neither content implementation imports or detects this fixture.

  Scenario: The unchanged editor and Markdown reader share another layout
    When I open the alternate layout at "/house.olai"
    Then the alternate layout fixture is mounted
    And the node "handles" is shown
    When I mark the page
    And I click the title of "handles"
    And I select all and type "handles under another layout"
    And I press "Enter"
    Then "house.olai" holds a node titled "handles under another layout"
    When the alternate layout opens Markdown
    Then the document open is "finishes.md"
    And the address is "/finishes.md"
    And the page has not reloaded
    When the alternate layout opens the outline
    Then the node "handles" has the title "handles under another layout"
    And the address is "/house.olai"
    And the page has not reloaded
    And there should be no page errors
