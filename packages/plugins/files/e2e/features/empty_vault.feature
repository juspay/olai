@scratch:empty
Feature: A new vault can become useful through the browser
  Scenario: Create the first outline, write its first row, and return after reload
    Given I open the app
    And I mark the page
    When I create the outline "first.olai" from the sidebar
    Then the address is "/first.olai"
    When I start the first line
    And I type "the first task in this vault"
    And I click away from the editor
    Then "first.olai" holds a node titled "the first task in this vault"
    And the page has not reloaded
    When I reload the page
    Then the outline list links to "first.olai"
    And the node titled "the first task in this vault" is shown
    And there should be no page errors

  Scenario: Create and edit a document before the vault has any outline
    Given I open the app
    And I mark the page
    When I create the document "first.md" from the sidebar
    Then the address is "/first.md"
    When I retype the document as:
      """
      **the first document in this vault**
      """
    And I save the document
    Then the document renders bold text "the first document in this vault"
    And the page has not reloaded
    When I reload the page
    Then the document renders bold text "the first document in this vault"
    And there should be no page errors

  Scenario: The first externally added outline appears without reloading the empty vault
    Given I open the app
    And I mark the page
    When I rewrite "arrival.olai" as:
      """
      {"id":"arrival","ord":"a0","title":"the first external row"}
      """
    Then the outline list links to "arrival.olai"
    And the node "arrival" is shown
    When I click the title of "arrival"
    And I select all and type "edited after first arrival"
    And I press "Enter"
    And I press "Escape"
    Then "arrival.olai" holds a node titled "edited after first arrival"
    When I remove the served file "arrival.olai"
    And I create the outline "replacement.olai" from the sidebar
    And I start the first line
    And I type "a fresh start"
    And I click away from the editor
    Then "replacement.olai" holds a node titled "a fresh start"
    And the page has not reloaded
    And there should be no page errors
