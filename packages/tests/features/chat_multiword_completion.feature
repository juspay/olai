@scratch:chat
Feature: Naming a node by its multi-word title in the composer
  Background:
    Given I rewrite "watchers.olai" as:
      """
      {"id":"odu-watch","ord":"a0","title":"Odu watcher scope"}
      {"id":"odu-build","ord":"a1","title":"Odu build scope"}
      """
    And I open the app
    And the agent panel is open

  Scenario: Spaces keep narrowing the title and the accepted node reaches the agent
    When I type "context @odu" into the chat
    Then the completion offers "odu-watch"
    And the completion offers "odu-build"
    When I press "Space" in the chat
    Then the completion offers "odu-watch"
    When I type "watcher scope" into the chat a letter at a time
    Then the completion offers "odu-watch"
    And the completion does not offer "odu-build"
    And no chat completion is selected
    When I press "ArrowDown" in the chat
    Then the selected chat completion is "odu-watch"
    When I accept the completion
    Then the chat input reads "context @odu-watch "
    And no completion is open
    And the composer is armed with "odu-watch"
    When I press "Enter" in the chat
    Then the agent's answer says "odu-watch is the node titled Odu watcher scope"
    And there should be no page errors

  Scenario: Completing a title mid-sentence preserves punctuation and the following words
    When I type "discuss @Odu watcher scope, please" into the chat
    And I put the caret after "discuss @Odu watcher scope" in the chat
    Then the completion offers "odu-watch"
    When I click the completion "odu-watch"
    Then the chat input reads "discuss @odu-watch, please"
    And the caret in the chat box is at 19
    And no completion is open
    And the composer is armed with "odu-watch"
    And there should be no page errors

  Scenario: Escape preserves the literal title and a later name can still complete
    When I type "discuss @odu watcher scope" into the chat
    Then the completion offers "odu-watch"
    When I press "Escape" in the chat
    And I close the agent panel
    And the agent panel is open
    Then the chat input reads "discuss @odu watcher scope"
    And no completion is open
    When I type "discuss @odu watcher scope and @odu build scope" into the chat
    Then the completion offers "odu-build"
    When I press "Tab" in the chat
    Then the chat input reads "discuss @odu watcher scope and @odu-build "
    And no completion is open
    When I press "Enter" in the chat
    Then the chat shows my message "discuss @odu watcher scope and @odu-build"
    And there should be no page errors

  Scenario: A newline ends the title query
    When I type "discuss @odu watcher scope" into the chat
    Then the completion offers "odu-watch"
    When I press "Shift+Enter" in the chat
    Then no completion is open
    And there should be no page errors

  Scenario: Running title words together does not invent a new search spelling
    When I type "context @oduwa" into the chat
    Then the completion does not offer "odu-watch"
    And no completion is open
    When I press "Enter" in the chat
    Then the chat shows my message "context @oduwa"
    And there should be no page errors
