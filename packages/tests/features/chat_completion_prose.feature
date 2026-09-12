@scratch:chat
Feature: Enter preserves prose that happens to match a node's note
  Background:
    Given I rewrite "prose.olai" as:
      """
      {"id":"review-hinges","ord":"a0","title":"Review hinges","done":"2026-08-03","desc":"alex and we can look at the hinges and decide what to do about the doors and then"}
      """
    And I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  Scenario Outline: A matching note does not turn Enter into replacement of literal prose
    When I type "<message>" into the chat
    Then the completion offers "review-hinges"
    And no chat completion is selected
    And the composer is armed with nothing
    When I press "Enter" in the chat
    Then the chat shows my message "<message>"
    And the agent's answer mentions "you said: <message>"
    And the composer is armed with nothing
    And there should be no page errors

    Examples:
      | message                                                       |
      | look at @review-hinges and decide what to do about the doors    |
      | discuss @alex and decide what to do about the doors             |
      | look at @is:done and then                                      |

  Scenario: Returning to an accepted handle cannot swallow the following clause
    When I type "look at @review-hinges" into the chat
    Then the completion offers "review-hinges"
    When I accept the completion
    Then the chat input reads "look at @review-hinges "
    When I type "and decide what to do about the doors" into the chat a letter at a time
    And I put the caret after "look at " in the chat
    And I put the caret after "look at @review-hinges and decide what to do about the doors" in the chat
    Then the completion offers "review-hinges"
    And no chat completion is selected
    When I press "Enter" in the chat
    Then the chat shows my message "look at @review-hinges and decide what to do about the doors"
    And there should be no page errors

  Scenario: Typing past an arrow selection restores Enter as Send
    When I type "look at @Review hinges" into the chat
    Then the completion offers "review-hinges"
    When I press "ArrowUp" in the chat
    Then the selected chat completion is "review-hinges"
    When I type " and decide what to do about the doors" into the chat a letter at a time
    Then the completion offers "review-hinges"
    And no chat completion is selected
    When I press "Enter" in the chat
    Then the chat shows my message "look at @Review hinges and decide what to do about the doors"
    And there should be no page errors

  Scenario: Remounting an arrow-selected multi-word query restores Enter as Send
    When I type "look at @Review hinges" into the chat
    Then the completion offers "review-hinges"
    When I press "ArrowDown" in the chat
    Then the selected chat completion is "review-hinges"
    When I close the agent fold
    And the node agent's fold is ready
    Then the completion offers "review-hinges"
    And no chat completion is selected
    When I press "Enter" in the chat
    Then the chat shows my message "look at @Review hinges"
    And there should be no page errors

  Scenario: Moving to another occurrence of the same query clears selection
    When I type "compare @Review hinges and @Review hinges" into the chat
    Then the completion offers "review-hinges"
    When I press "ArrowDown" in the chat
    Then the selected chat completion is "review-hinges"
    When I put the caret after "compare @Review hinges" in the chat
    Then the completion offers "review-hinges"
    And no chat completion is selected
    When I press "Enter" in the chat
    Then the chat shows my message "compare @Review hinges and @Review hinges"
    And there should be no page errors

  Scenario: A live replacement at the selected position does not inherit selection
    When I type "look at @Review hinges" into the chat
    Then the completion offers "review-hinges"
    When I press "ArrowDown" in the chat
    Then the selected chat completion is "review-hinges"
    When I rewrite "prose.olai" as:
      """
      {"id":"replacement-hinges","ord":"a0","title":"Review hinges"}
      """
    Then the completion offers "replacement-hinges"
    And the completion does not offer "review-hinges"
    And no chat completion is selected
    When I press "Enter" in the chat
    Then the chat shows my message "look at @Review hinges"
    And there should be no page errors
