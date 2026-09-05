@scratch:good
Feature: Document editing survives changes to the plugin roster
  Background:
    Given I open the document "finishes.md"
    When I start editing the document
    And I retype the document as:
      """
      # Finishes

      Handles: **my unsaved draft**.
      """

  Scenario: An unrelated plugin change keeps the editor and its unsaved text
    When I mark the document editor element
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then the original document editor element is still mounted
    And the document editor holds text containing "my unsaved draft"
    When I save the document
    Then the document renders bold text "my unsaved draft"
    And the document editor is gone

  Scenario: A rebuild keeps the original conflict baseline as well as the draft
    When I rewrite "finishes.md" as:
      """
      # Finishes

      Handles: **external version**.
      """
    Then the editor notices the file changed on disk
    When I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    Then the document editor holds text containing "my unsaved draft"
    And the editor notices the file changed on disk
    When I save the document
    Then the save is refused saying "has changed since it was read"
    When I cancel the document editor
    Then the document renders bold text "external version"

  Scenario: Cancelling a preserved draft prevents it from returning on the next rebuild
    When I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    Then the document editor holds text containing "my unsaved draft"
    When I cancel the document editor
    And I open the plugins panel
    And I switch the plugin "chat" on
    And I close the plugins panel
    Then the document editor is gone
    When I start editing the document
    Then the document editor holds no text containing "my unsaved draft"
