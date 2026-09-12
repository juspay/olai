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
  Scenario: Folding releases only that node's idle hold
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the "claude" agent on node "order"
    And the node agent's fold is ready
    And I fold node agent "install"
    Then the agent "install" stands "asleep"
    And the agent "order" remains "idle" across two idle deadlines
    When I use the fold on node "order"
    And I ask the agent "still reading"
    Then the agent has answered "still reading" exactly once

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

  Scenario: Ask agent on a child arms the nearest ancestor and unfolds it
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I fold node agent "install"
    And I open the node menu of "hinges"
    And I choose "Ask agent" from the node menu
    Then node agent "install" is unfolded
    When I use the fold on node "install"
    Then the composer is armed with "hinges"

  Scenario: The palette targets the focused child's ancestor with another fold open
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I fold node agent "install"
    And I open the "claude" agent on node "order"
    And the node agent's fold is ready
    And I point at row "hinges" in outline "house.olai"
    And I press the palette shortcut
    And I ask the palette "> hinges question"
    Then node agent "install" is unfolded
    When I use the fold on node "install"
    Then the agent has answered "hinges question" exactly once
    When I use the fold on node "order"
    Then the chat has not answered "hinges question"

  Scenario: The palette refuses a focused row without an ancestor agent and keeps the words
    When I point at row "hinges" in outline "house.olai"
    And I press the palette shortcut
    And I ask the palette "> keep these words"
    Then the palette refuses with "no agent above this row — start one" and retains "> keep these words"
    And no agent fold is open

  Scenario: The palette refuses with no focused row
    When I press the palette shortcut
    And I ask the palette "> keep these words"
    Then the palette refuses with "no agent above this row — start one" and retains "> keep these words"
    And no agent fold is open

  Scenario: Reload folds every conversation
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the "claude" agent on node "order"
    And the node agent's fold is ready
    And I reload the page
    Then no agent fold is open

  Scenario: An unbound ancestor refuses Ask agent and the palette without starting anything
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen","custom":{"chat-agent-session":"claude"}}
      {"id":"hinges","parent":"kitchen","ord":"a0","title":"hinges"}
      """
    And I open the outline "house.olai"
    When I open the node menu of "hinges"
    And I choose "Ask agent" from the node menu
    Then the node menu of "hinges" says "this agent has no session — start one"
    And no agent fold is open
    When I point at row "hinges" in outline "house.olai"
    And I press the palette shortcut
    And I ask the palette "> keep the unbound question"
    Then the palette refuses with "this agent has no session — start one" and retains "> keep the unbound question"
    And no agent fold is open
    And the agent "kitchen" stands "unbound"

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
    Then a notification says "is waiting on your answer"
    When I unfold node agent "install"
    And I choose "birch"
    And I answer the question
    Then the question has been answered
    When I close the agent fold
    And the notification is pressed
    Then no agent fold is open

  Scenario: Ask agent finds the ancestor while search is unavailable
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I close the agent fold
    And I open the plugins panel
    And I switch the plugin "search" off
    And I close the plugins panel
    And I open the node menu of "hinges"
    And I choose "Ask agent" from the node menu
    Then node agent "install" is unfolded
    When I use the fold on node "install"
    Then the composer is armed with "hinges"


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
    Then the node menu offers "Add property…"
    When I choose "Add property…" from the node menu
    And I write the property "review-note" holding "kept" on "install"
    Then the node "install" shows the property "review-note" holding "kept"
    And "house.olai" holds the node "install" with "review-note" set to "kept"
