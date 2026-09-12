@scratch:chat
Feature: A new chat has an Inbox node from its first message
  Scenario Outline: Recent starts and unfolds a new conversation on <screen>
    Given I open the outline "house.olai"
    When I press new chat in Recent
    Then the new Inbox conversation is unfolded as "new-chat" with engine "claude"
    And the Inbox has 1 filed conversations
    When I ask the agent "done hinges"
    Then the agent is idle
    And "house.olai" holds a node marked done titled "pick the hinges"
    And the new chat receives the ordinary node contract
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario: The palette starts immediately with one engine
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "Agents" into the palette
    And I pick new chat in the Agents palette
    Then the new Inbox conversation is unfolded as "new-chat" with engine "claude"
    When I ask the agent "created from the palette"
    Then the agent has answered "created from the palette" exactly once
    And there should be no page errors

  @codex
  Scenario Outline: Recent offers the same engine menu as the aside on <screen>
    Given I open the outline "house.olai"
    When I press new chat in Recent
    Then the agent engine menu offers "Claude Code"
    And the agent engine menu offers "Codex"
    When I choose new chat engine "Codex"
    Then the new Inbox conversation is unfolded as "new-chat" with engine "codex"
    When I ask the agent "chosen in Recent"
    Then the agent has answered "chosen in Recent" exactly once

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  @codex
  Scenario: The palette offers engine names and forgets a dismissed choice
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "Agents" into the palette
    And I pick new chat in the Agents palette
    Then the new chat palette offers engines "Claude Code|Codex"
    When I press "Escape"
    And I press the palette shortcut
    And I type "Agents" into the palette
    And I pick new chat in the Agents palette
    And I choose palette new chat engine "codex"
    Then the new Inbox conversation is unfolded as "new-chat" with engine "codex"
    When I ask the agent "chosen in the palette"
    Then the agent has answered "chosen in the palette" exactly once

  Scenario: An unavailable Inbox refuses and capture returning permits retry
    Given I open the outline "house.olai"
    When I open the plugins panel
    And I switch the plugin "capture" off
    And I press "Escape"
    And I press new chat in Recent
    Then new chat says "the Inbox is unavailable; no conversation was created"
    And the Inbox contains no chat children
    When I open the plugins panel
    And I switch the plugin "capture" on
    And I press "Escape"
    And I press new chat in Recent
    Then the new Inbox conversation is unfolded as "new-chat" with engine "claude"

  Scenario: A held creation cannot be spent twice across the two faces
    Given I open the outline "house.olai"
    When the next agent boot will hang
    And I press new chat in Recent
    Then new chat in Recent is starting
    When I press the palette shortcut
    And I type "Agents" into the palette
    And I pick new chat in the Agents palette
    Then the palette says a new conversation is already starting
    When I press "Escape"
    And the agent is released
    Then the new Inbox conversation is unfolded as "new-chat" with engine "claude"
    And the Inbox has 1 filed conversations

  @no-agent
  Scenario: Without an engine neither face creates a conversation
    Given I open the outline "house.olai"
    Then new chat in Recent is unavailable
    When I press the palette shortcut
    And I type "Agents" into the palette
    And I pick new chat in the Agents palette
    Then the palette says no agent engine is available
    And the Inbox contains no chat children

  Scenario: A refused start leaves its plain node available for retry
    Given I open the outline "house.olai"
    When the agent refuses to new a conversation
    And I press new chat in Recent
    Then the refused new chat leaves a plain Inbox node as "new-chat"
    And no agent fold is open
    When the agent will new a conversation again
    And I open the Inbox from the sidebar
    And I open the "claude" agent on node "new-chat"
    And I ask the agent "retry on its own node"
    Then the agent has answered "retry on its own node" exactly once
    And the Inbox has 1 filed conversations

  Scenario: New chat leaves another node's pending question and draft intact
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I remember this conversation as "waiting"
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I type "kept while another node starts" into the question's "note" box
    And I press new chat in Recent
    Then the new Inbox conversation is unfolded as "new-chat" with engine "claude"
    And the panel has a different conversation from "waiting"
    And the agent "install" stands "needs-you"
    When I ask the agent "independent new conversation"
    Then the agent has answered "independent new conversation" exactly once
    When I press the agent "install"
    Then the question's "note" box still reads "kept while another node starts"
    When I type "2" into the question's "howMany" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "kept while another node starts"
    And there should be no page errors
