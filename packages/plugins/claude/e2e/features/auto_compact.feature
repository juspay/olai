@claude @scratch:chat @agent-stored
Feature: A Claude chat is told where to compact its conversation
  Chat's `auto-compact` switch and `compact-at` size decide where a Claude
  conversation compacts: olai puts auto-compaction on, at the size plus the
  33k Claude Code keeps in reserve, into the settings every session open
  carries, and takes away the host variables that would override it. Off, olai
  says nothing at all.

  The fake answers `compaction <label>` with what its last session open said
  and which overriding variables its own spawn sees, so each check reads what
  crossed to the agent. The harness arms one such variable on the server
  (`DISABLE_AUTO_COMPACT`, the descriptor's `env`), the way a host might.

  A change to either setting restarts the chat row, on the server and then in
  the tab, and the tab's rebuild closes the conversation's fold. So every
  change below waits for the old composer to be gone from the page and for
  the agent to be asked to reopen the conversation, then opens the fold again
  before the next message: that message must reach the agent the new value
  opened.

  Background:
    Given I open the app
    And I show the done nodes
    And I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  Scenario: Nothing set: the agent compacts at 200k, and the host's override does not reach it
    When I ask the agent "compaction first"
    Then the agent is idle
    And the agent's answer mentions "compaction first: on at window 233000; overrides seen: none"

  Scenario: A resumed conversation is told the same, on the call that loads it
    When I ask the agent "keep this conversation"
    Then the agent is idle
    When I remember this conversation as "kept"
    And the agent notes every conversation it loads
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I switch the plugin "chat" on
    And I close the plugins panel
    Then the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    And the panel is in the remembered conversation "kept"
    When I ask the agent "compaction resumed"
    Then the agent is idle
    And the agent's answer mentions "compaction resumed: on at window 233000; overrides seen: none; opened by session/load"

  Scenario: Switched off, olai says nothing and strips nothing; switched on, it is back
    When I ask the agent "before the switch"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I expand the plugin "chat"
    And the "chat" setting "auto-compact" is described as "compact its conversation on its own"
    And I toggle "chat" setting "auto-compact"
    Then file "_olai/Settings.olai" has namespace "chat" setting "auto-compact" as "no"
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction off"
    Then the agent is idle
    And the agent's answer mentions "compaction off: not set; overrides seen: DISABLE_AUTO_COMPACT"
    Given the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I toggle "chat" setting "auto-compact"
    And I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction on again"
    Then the agent is idle
    And the agent's answer mentions "compaction on again: on at window 233000; overrides seen: none"
    And there should be no page errors

  Scenario: A larger size moves the window, and the default puts it back
    When I ask the agent "before the size"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I pick "500k" for "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "500k"
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction larger"
    Then the agent is idle
    And the agent's answer mentions "compaction larger: on at window 533000; overrides seen: none"
    Given the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I use the default for "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "<absent>"
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction default"
    Then the agent is idle
    And the agent's answer mentions "compaction default: on at window 233000; overrides seen: none"
    And there should be no page errors

  Scenario: A size written in the file that is not on the list is refused, and the default is used
    # FROM 300k, so the refusal is a change the row restarts for: the refused
    # value falls back to 200k, which is not where the agent was.
    When I ask the agent "before the file"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I pick "300k" for "chat" setting "compact-at"
    And I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction at 300k"
    Then the agent is idle
    And the agent's answer mentions "compaction at 300k: on at window 333000"
    Given the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I write "42" for the "chat" setting "compact-at" on disk
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction after the typo"
    Then the agent is idle
    And the agent's answer mentions "compaction after the typo: on at window 233000; overrides seen: none"
    When I open the plugins panel
    Then the "chat" setting "compact-at" shows refused file text "42" inline with default "200k"
    And there should be no page errors

  Scenario: A setting changed under an open conversation: the conversation carries on in place
    Given I mark the page
    When I ask the agent "the first message"
    Then the agent is idle
    And the agent's answer mentions "you said: the first message"
    When I remember this conversation as "ongoing"
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    And I open the plugins panel
    And I pick "100k" for "chat" setting "compact-at"
    And I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    And the panel is in the remembered conversation "ongoing"
    When I ask the agent "the next message"
    Then the agent is idle
    And the agent's answer mentions "you said: the next message"
    When I ask the agent "compaction smaller"
    Then the agent is idle
    And the agent's answer mentions "compaction smaller: on at window 133000"
    And the page has not reloaded
    And there should be no page errors
