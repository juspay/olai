@acp-session-features @scratch:chat
Feature: Agent session controls and progress
  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And I follow the agent's open-page link
    And the node page conversation is ready for "kitchen"

  Scenario: Advertised select and boolean settings reach the agent
    When I open the session settings
    And I set session setting "Reasoning" to "high"
    And I set session setting "Mode" to "plan"
    And I enable fast mode
    And I save a screenshot as "acp-session-settings.png"
    And I open the session settings
    And I ask the agent "settings"
    Then the agent's answer mentions "reasoning=high, mode=plan, fast=true"

  Scenario: Model changes replace the available reasoning choices
    When I choose the chat model "Fake Two"
    And I open the session settings
    And I set session setting "Reasoning" to "xhigh"
    And I open the session settings
    And I ask the agent "settings"
    Then the agent's answer mentions "reasoning=xhigh"

  Scenario: Refused settings keep the confirmed value
    Given the agent refuses model changes
    When I open the session settings
    And I attempt session setting "Reasoning" to "high"
    Then the chat shows a refusal
    And session setting "Reasoning" is "medium"

  Scenario: Agent notifications refresh session controls
    When I ask the agent "settings update"
    # Settings close while a turn is busy. Wait for this turn's response,
    # rather than opening against the idle frame that preceded its acceptance.
    Then the agent's answer mentions "reasoning=high, mode=plan, fast=true"
    When I open the session settings
    Then session setting "Reasoning" is "high"
    And session setting "Mode" is "plan"

  Scenario: A plan replaces its entries and can be cleared
    Then there is no execution plan
    When I ask the agent "execution-plan"
    Then the execution plan contains "Inspect the outline" as "in_progress"
    And the execution plan contains "Old next step" as "pending"
    When I save a screenshot as "acp-execution-plan.png"
    And the agent is released
    Then the agent is idle
    And the execution plan contains "Verify the changes" as "completed"
    And the execution plan omits "Old next step"
    When I ask the agent "execution-plan clear"
    Then there is no execution plan

  Scenario: Command stdout and stderr stream and survive handle release
    When I ask the agent "terminal live"
    Then terminal output contains "stdout ready"
    And terminal output contains "stderr ready"
    And terminal output contains "Running"
    When I save a screenshot as "acp-terminal-output.png"
    And the agent is released
    Then the agent is idle
    And terminal output contains "SIGTERM"
    And terminal output contains "stdout ready"
    And the agent's answer mentions "Terminal released"

  Scenario: Output limits retain complete UTF-8 characters and exit status
    When I ask the agent "terminal truncate"
    Then the agent is idle
    And terminal output contains "éEND"
    And terminal output contains "Earlier output omitted"
    And terminal output contains "Exit 7"

  Scenario: A zero output limit still reports truncation and exit
    When I ask the agent "terminal zero"
    Then the agent is idle
    And terminal output contains "Earlier output omitted"
    And terminal output contains "Exit 7"

  Scenario: Cancelling a turn stops its running terminal
    When I ask the agent "terminal live"
    Then terminal output contains "stdout ready"
    When I cancel the turn
    Then the agent is idle
    And terminal output contains "SIGTERM"

  Scenario: A new conversation clears the previous execution plan
    When I ask the agent "execution-plan"
    Then the execution plan contains "Inspect the outline" as "in_progress"
    When the agent is released
    Then the agent is idle
    When I start a fresh session
    Then there is no execution plan

  Scenario: A new conversation gets the agent's default settings
    When I remember this conversation as "before fresh settings"
    And I open the session settings
    And I set session setting "Reasoning" to "high"
    And I open the session settings
    And I start a fresh session
    Then the panel is ready in a new conversation after "before fresh settings"
    When I open the session settings
    Then session setting "Reasoning" is "medium"

  Scenario: Reopening the page retains the running plan and command output
    When I ask the agent "execution-plan"
    Then the execution plan contains "Inspect the outline" as "in_progress"
    When I reload the page
    And the node page conversation is ready for "kitchen"
    Then the agent is working
    Then the execution plan contains "Inspect the outline" as "in_progress"
    When the agent is released
    Then the agent is idle
    When I ask the agent "terminal live"
    Then terminal output contains "stdout ready"
    When I reload the page
    And the node page conversation is ready for "kitchen"
    Then the agent is working
    Then terminal output contains "stdout ready"
    When the agent is released
    Then the agent is idle
    And terminal output contains "SIGTERM"
