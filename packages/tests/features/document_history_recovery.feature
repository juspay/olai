@scratch:good
Feature: Document history reads current files after leaving the page
  Background:
    Given I rewrite "history.md" as:
      """
      **original document**
      """
    And I open the document "history.md"
    And I mark the page

  Scenario: Back reads externally replaced bytes and saves against the new version
    When I click the outline "garden.olai"
    And I rewrite "history.md" as:
      """
      **replacement while away**
      """
    And I go back
    Then the document renders bold text "replacement while away"
    And the document editor is gone
    When I start editing the document
    Then the document editor holds text containing "replacement while away"
    When I retype the document as:
      """
      **saved after Back**
      """
    And I save the document
    Then the document editor is gone
    And the document renders bold text "saved after Back"
    When I go forward
    Then the node "herbs" is shown
    When I go back
    Then the document renders bold text "saved after Back"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Back to a removed document recovers after restoration without reviving an abandoned draft
    When I start editing the document
    And I retype the document as:
      """
      **abandoned before leaving**
      """
    And I click the outline "garden.olai"
    And I remove the served file "history.md"
    And I go back
    Then the main pane says there is no document "history.md"
    When I rewrite "history.md" as:
      """
      **restored after Back**
      """
    Then the document renders bold text "restored after Back"
    And the document editor is gone
    When I start editing the document
    Then the document editor holds no text containing "abandoned before leaving"
    When I retype the document as:
      """
      **edited after history recovery**
      """
    And I save the document
    Then the document renders bold text "edited after history recovery"
    And the page has not reloaded
    And there should be no page errors
