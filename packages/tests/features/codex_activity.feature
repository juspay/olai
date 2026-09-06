@codex @scratch:chat
Feature: Codex subagents and background terminals are visible
  These fixtures use codex-acp 1.10's native child sessions and AIR async tasks.
  They deliberately reuse tool IDs across sessions and carry no Claude metadata.

  Background:
    Given I open the app
    And I show the done nodes
    And the agent panel is open
    When I choose the agent "codex"

  Scenario: Subagent tools have their own door and never merge with root tools
    When I ask the agent "native agents"
    Then the agent is idle
    And the conversation carries none of the subagent's calls
    And the chat does not yet show "Private child report"
    And the call that spawned it offers a door to 2 calls, as "explore the outline"
    When I unfold the tool call
    Then the tool call is reporting "Private child report"
    When I open the agent's work from the transcript
    Then the agent's work is open, and it is "explore the outline"
    And the agent's work shows 2 calls
    And I can close the agent's work

  Scenario Outline: The live subagent strip clears when the turn ends
    When I ask the agent "native slow"
    Then the strip lists 1 agents still out
    When I open "explore the outline" from the strip
    Then the agent's work shows 2 calls
    When <ending>
    Then the agent is idle
    And the strip lists no agent still out
    And the header has stopped saying the agent is working

    Examples:
      | ending                |
      | the agent is released |
      | I cancel the turn     |

  Scenario: Nested subagents stay inside their parent agent's work
    When I ask the agent "native nested"
    Then the agent is idle
    And the call that spawned it offers a door to 3 calls, as "explore the outline"
    When I open the agent's work from the transcript
    Then the agent's work shows 3 calls

  Scenario: A child permission remains visible and attributed to the child
    When I ask the agent "native asks"
    Then the chat shows a question
    And the question's lane names itself, as "explore the outline"
    When I choose "Allow Once"
    And I answer the question
    Then the agent is idle

  Scenario Outline: A background terminal survives the turn and ends in its own words
    When I ask the agent "native watch <state>"
    Then the agent is idle
    And the chat says a background task is watching "watch files"
    And the strip says "watch files" is running
    When I ask the agent "hello"
    Then the agent is idle
    And the strip says "watch files" is running
    When the agent is released
    Then the chat says that task ended "<state>"
    And the chat says no background task is still running
    And the agent is idle

    Examples:
      | state     |
      | completed |
      | failed    |
      | stopped   |

  Scenario: A child elicitation without a tool ID still names the child
    When I ask the agent "native elicits"
    Then the chat shows a question
    And the question's lane names itself, as "explore the outline"
    When I choose "Upper cabinets"
    And I answer the question
    Then the agent is idle

  @agent-stored
  Scenario: Loading a stored conversation restores child work and an active terminal
    When I open the unassigned chats
    And I pick the conversation "an older conversation" under the agent "codex"
    Then the conversation is titled "an older conversation"
    And the call that spawned it offers a door to 2 calls, as "explore the outline"
    And the strip says "watch files" is running
    When the agent is released
    Then the chat says that task ended "stopped"
    And the chat says no background task is still running

  @agent-stored
  Scenario: Activity from a conversation left behind cannot populate the new one
    When I open the unassigned chats
    And I pick the conversation "an older conversation" under the agent "codex"
    Then the strip says "watch files" is running
    When I start a new conversation
    And the agent is released
    And I ask the agent "hello"
    Then the agent's answer mentions "hello"
    And the strip lists no agent still out
    And the chat says no background task is still running
