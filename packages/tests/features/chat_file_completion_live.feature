@scratch:chat
Feature: Open file completions follow the served directory
  Background:
    Given I rewrite "orchid-original.md" as:
      """
      # Original file
      """
    And I open the app
    And the agent panel is open
    And I mark the page
    When I type "read @orchid" into the chat
    Then the completion offers "orchid-original.md"

  Scenario: Removing the only matching file closes the list and Enter sends unchanged text
    When I remove the served file "orchid-original.md"
    Then no completion is open
    And the chat input reads "read @orchid"
    When I press "Enter" in the chat
    Then the chat shows my message "read @orchid"
    And the agent's answer mentions "you said: read @orchid"
    When I rewrite "orchid-restored.md" as:
      """
      # Restored file
      """
    And I type "read @orchid" into the chat
    Then the completion offers "orchid-restored.md"
    And the completion does not offer "orchid-original.md"
    When I accept the completion
    And I send the chat message
    Then the agent's answer mentions "you said: read @orchid-restored.md"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A replacement file becomes selectable without retyping the query
    When I rewrite "orchid-replacement.md" as:
      """
      # Replacement file
      """
    And I remove the served file "orchid-original.md"
    Then the completion offers "orchid-replacement.md"
    And the completion does not offer "orchid-original.md"
    And the chat input reads "read @orchid"
    When I click the completion "orchid-replacement.md"
    Then the chat input reads "read @orchid-replacement.md "
    And the caret is in the chat box
    When I send the chat message
    Then the agent's answer mentions "you said: read @orchid-replacement.md"
    And the page has not reloaded
    And there should be no page errors
