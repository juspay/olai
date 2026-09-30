@scratch:chat @rewind
Feature: Rewind a conversation into a separate session
  Background:
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"

  @codex
  Scenario Outline: Rewind preserves the preceding answer and accepts <sending> on <engine>
    When I open the "<engine>" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "first answer"
    Then the agent is idle
    When I ask the agent "second answer"
    Then the agent is idle
    When I remember this conversation as "original"
    And I rewind my message "second answer"
    Then the panel has a different conversation from "original"
    And the chat input reads "second answer"
    And the rewind transcript contains "first answer" but not "second answer"
    When I type "<sending>" into the chat
    And I send the chat message
    Then the agent has answered "<sending>" exactly once
    When I open the fold history
    Then the panel says this agent has had 1 past session
    And there should be no page errors

    Examples:
      | engine | sending       |
      | claude | edited answer |
      | claude | second answer |
      | codex  | edited answer |
      | codex  | second answer |
    @phone
    Examples:
      | engine | sending       |
      | claude | edited answer |

  Scenario: The first message rewinds to a fresh session and preserves the old draft
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "first answer"
    Then the agent is idle
    When I type "draft kept in original" into the chat
    And I remember this conversation as "original"
    And I rewind my message "first answer"
    Then the panel has a different conversation from "original"
    And the chat input reads "first answer"
    And the rewind transcript is empty
    When I open the fold history
    And I open the past session "first answer"
    Then the chat input reads "draft kept in original"
    And the agent has answered "first answer" exactly once

  @codex
  Scenario Outline: Replay restores rewind points on <engine>
    When I open the "<engine>" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "first answer"
    Then the agent is idle
    When I ask the agent "second answer"
    Then the agent is idle
    When I reload the page
    And I open the "<engine>" agent on node "install"
    And the node agent's fold is ready
    And I rewind my message "second answer"
    Then the chat input reads "second answer"
    And the rewind transcript contains "first answer" but not "second answer"
    Examples:
      | engine |
      | claude |
      | codex  |

  Scenario Outline: A failed <operation> leaves the conversation and draft intact
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "first answer"
    Then the agent is idle
    When I ask the agent "second answer"
    Then the agent is idle
    When I type "my draft" into the chat
    And the rewind fixture refuses "<operation>"
    And I rewind my message "second answer"
    Then rewind reports a failure
    And the chat input reads "my draft"
    And the agent has answered "second answer" exactly once
    When the rewind fixture accepts requests
    And I rewind my message "second answer"
    Then the chat input reads "second answer"
    Examples:
      | operation |
      | fork      |
      | load      |

  Scenario: Rewind is hidden and refused while a turn is running
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "first answer"
    Then the agent is idle
    When I hold incoming updates to the original browser tab
    And I open another browser tab
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "hold"
    And I ask the agent "queued answer"
    Then the chat offers no rewind actions
    When I use the original browser tab
    And I click the stale rewind action for "first answer"
    And I release incoming updates to the original browser tab
    Then rewind reports a failure
    When the agent is released
    Then the agent is idle

  @opencode
  Scenario: Engines without message cutoffs offer no rewind
    When I open the "opencode" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "first answer"
    Then the agent is idle
    And the chat offers no rewind actions

  Scenario: Files changed after the cutoff remain changed
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "first answer"
    Then the agent is idle
    When I ask the agent "done hinges"
    Then the agent is idle
    And "house.olai" holds a node marked done titled "pick the hinges"
    When I rewind my message "done hinges"
    Then the chat input reads "done hinges"
    And "house.olai" holds a node marked done titled "pick the hinges"

  Scenario: A missing message identity cannot silently fork the entire conversation
    When the rewind fixture omits message identities
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "first answer"
    Then the agent is idle
    When I ask the agent "second answer"
    Then the agent is idle
    And my message "second answer" has no rewind action

  Scenario: An adapter that does not advertise fork gets no control
    When the rewind fixture does not advertise fork
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "first answer"
    Then the agent is idle
    And the chat offers no rewind actions

  Scenario: A concurrent send cannot be redirected into the fork
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "first answer"
    Then the agent is idle
    When I ask the agent "second answer"
    Then the agent is idle
    When I open another browser tab
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I use the original browser tab
    And the next conversation load will hang
    And I rewind my message "second answer"
    Then the rewind is waiting for replay
    When I use the other browser tab
    And I ask the agent "concurrent words"
    And the agent is released
    And the rewind fixture accepts requests
    Then the agent is idle
    And the rewind transcript contains "first answer" but not "concurrent words"
    When I open the fold history
    And I open the past session "first answer"
    Then the chat input reads "concurrent words"
    When I use the original browser tab
    Then the chat input reads "second answer"
