@scratch:good
Feature: A document search result lands at its matching source line
  Background:
    Given a long search document with "zinnialanding" on file line 140
    And I open the outline "house.olai"

  Scenario: Enter opens the matching block and Back returns to the searched page
    When I press the palette shortcut
    And I type "zinnialanding" into the palette
    Then the palette lists the document "landing.md"
    When I press "Enter"
    Then the document match "zinnialanding" is lit in the viewport at line 140
    When I go back
    Then the sidebar marks the outline "house.olai" as the one open
    And there should be no page errors

  @phone
  Scenario: A phone opens the same matching block
    When I press the palette shortcut
    And I type "zinnialanding" into the palette
    Then the palette lists the document "landing.md"
    When I press "Enter"
    Then the document match "zinnialanding" is lit in the viewport at line 140
    And there should be no page errors

  Scenario: A stale source line opens at the top
    When I open the address "/landing.md?q=zinnialanding#L999"
    Then the long search document is at the top without a highlight
    And there should be no page errors

  Scenario: A match deep in a list lands on its own item
    Given a long search list with "zinnialanding" on file line 140
    When I press the palette shortcut
    And I type "zinnialanding" into the palette
    Then the palette lists the document "landing.md"
    When I press "Enter"
    Then the document match "zinnialanding" is lit in the viewport at line 140
    And there should be no page errors
