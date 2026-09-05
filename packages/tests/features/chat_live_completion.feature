@scratch:chat
Feature: An open chat completion follows changes to its node targets
  Scenario: A removed suggestion is replaced without losing the draft and the new node reaches the harness
    Given I rewrite "live-nodes.olai" as:
      """
      {"id":"old-target","ord":"a0","title":"orchid original task"}
      """
    And I open the app
    And the agent panel is open
    When I type "context @orchid" into the chat
    Then the completion offers "old-target"
    When I rewrite "live-nodes.olai" as:
      """
      {"id":"new-target","ord":"a0","title":"orchid replacement task"}
      """
    Then the completion offers "new-target"
    And the completion does not offer "old-target"
    And the chat input reads "context @orchid"
    When I accept the completion
    Then the chat input reads "context @new-target "
    And the composer is armed with "new-target"
    When I send the chat message
    Then the agent's answer says "new-target is the node titled orchid replacement task"
    And there should be no page errors

  Scenario: Clearing a live completion and reopening it cannot revive a removed node
    Given I rewrite "live-nodes.olai" as:
      """
      {"id":"old-target","ord":"a0","title":"orchid original task"}
      """
    And I open the app
    And the agent panel is open
    When I type "context @orchid" into the chat
    Then the completion offers "old-target"
    When I type "draft without a completion" into the chat
    And I rewrite "live-nodes.olai" as:
      """
      {"id":"new-target","ord":"a0","title":"orchid after clearing"}
      """
    And I type "context @orchid" into the chat
    Then the completion offers "new-target"
    And the completion does not offer "old-target"
    When I accept the completion
    And I send the chat message
    Then the agent's answer says "new-target is the node titled orchid after clearing"
    And there should be no page errors
