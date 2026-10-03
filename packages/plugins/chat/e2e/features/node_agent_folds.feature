@scratch:chat
Feature: A node agent's conversation unfolds in the outline
  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And I show the done nodes

  Scenario: A fold owns a transcript and composer and its send writes the vault
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the fold on "install" holds its transcript and composer
    When I ask the agent "done order"
    Then the agent is idle
    And node "order" is done
    And there should be no page errors

  Scenario: Two open folds answer independent sends and keep independent drafts
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I type "cabinet draft" into the chat
    And I open the "claude" agent on node "order"
    And the node agent's fold is ready
    Then the chat input reads ""
    When I ask the agent "order question"
    Then the agent has answered "order question" exactly once
    When I use the fold on node "install"
    Then the chat input reads "cabinet draft"
    When I send the chat message
    Then the agent has answered "cabinet draft" exactly once
    And the chat has not answered "order question"
    When I use the fold on node "order"
    Then the chat has not answered "cabinet draft"
    And node agent "install" is unfolded
    And node agent "order" is unfolded

  @node-idle-fast
  Scenario: Folding retains the reading and leaving the page releases its idle hold
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the "claude" agent on node "order"
    And the node agent's fold is ready
    And I fold node agent "install"
    Then the agent "install" remains "idle" across two idle deadlines
    And the agent "order" remains "idle" across two idle deadlines
    When I use the fold on node "order"
    And I ask the agent "still reading"
    Then the agent has answered "still reading" exactly once
    When I click the outline "yard.olai"
    Then the agent "install" stands "asleep"
    And the agent "order" stands "asleep"

  Scenario: A question is answered inside its fold
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I type "oak" into the question's "note" box
    And I type "2" into the question's "howMany" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "oak"

  Scenario: Reload folds every conversation
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the "claude" agent on node "order"
    And the node agent's fold is ready
    And I reload the page
    Then no agent fold is open

  @alerts
  Scenario: A notification reveals the first waiting agent even when the latest banner names another
    Given the notification worker is ready
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "hello"
    Then the agent is idle
    When I ask the agent "ask later"
    And I close the agent fold
    And the agent is released
    Then the agent "install" stands "needs-you"
    When I open the "claude" agent on node "order"
    And the node agent's fold is ready
    And I ask the agent "hello"
    Then the agent is idle
    When I ask the agent "ask later"
    And I close the agent fold
    And the agent is released
    Then the agent "order" stands "needs-you"
    When the notification is pressed
    Then node agent "order" is unfolded
    And node agent "install" is folded
    When I use the fold on node "order"
    Then the chat shows a question
    And the panel is open at the question

  @alerts
  Scenario: A delayed notification click opens nothing after its question was answered
    Given the notification worker is ready
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "ask later"
    And I close the agent fold
    And the agent is released
    Then a notification says "Waiting on your answer"
    When I unfold node agent "install"
    And I choose "birch"
    And I answer the question
    Then the question has been answered
    When I close the agent fold
    And the notification is pressed
    Then no agent fold is open



  @review-menu
  Scenario: A mirror opens independently from its agent's original row
    Given I rewrite "mirrored.olai" as:
      """
      {"id":"original","title":"Original","ord":"a0"}
      {"id":"copy","mirror":"original","ord":"a1"}
      """
    And I open the outline "mirrored.olai"
    When I open the "claude" agent on node "original"
    And the node agent's fold is ready
    Then only outline record "original" has an agent fold
    When I press the standing on outline record "copy"
    Then both outline records "original" and "copy" have an agent fold
    When I press the standing on outline record "copy"
    Then only outline record "original" has an agent fold

  @review-menu
  Scenario: A binding-only row can still add a property
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I close the agent fold
    And I open the node menu of "install"
    When I pick "Add property…" in the "More" submenu of the node menu
    And I write the property "review-note" holding "kept" on "install"
    Then the node "install" shows the property "review-note" holding "kept"
    And "house.olai" holds the node "install" with "review-note" set to "kept"
