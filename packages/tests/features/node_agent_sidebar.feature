@node-agent-sidebar @scratch:chat
Feature: Agent activity is reachable from Recent and the palette
  Scenario: Recent caps every standing by activity and the palette reaches the oldest asleep agent
    Given the sidebar has eleven agents with dated vault edits
    And I open the outline "recent.olai"
    Then Recent lists "recent-10 recent-9 recent-8 recent-7 recent-6 recent-5 recent-4 recent-3 recent-2 recent-1"
    And Needs you is absent
    And the Recent row "recent-10" draws the "asleep" dot before its age
    And the Recent row "recent-1" draws the "no session bound" dot before its age
    When I press the palette shortcut
    And I type "Agents" into the palette
    Then the Agents palette lists 11 agents
    When I pick the Agents palette row "recent-0"
    Then node agent "recent-0" is unfolded
    And the node agent's fold is ready
    When I ask the agent "palette reached the oldest agent"
    Then the agent has answered "palette reached the oldest agent" exactly once
    And the Recent row "recent-0" is current
    And the Recent row "recent-0" draws the "idle" dot before its age
    And there should be no page errors

  Scenario: An unbound palette row navigates without opening a conversation
    Given the sidebar has eleven agents with dated vault edits
    And I open the outline "house.olai"
    When I press the palette shortcut
    And I type "Agents" into the palette
    And I pick the Agents palette row "recent-1"
    Then the node "recent-1" is shown
    And no agent fold is open
    And there should be no page errors

  Scenario: Recent follows speech and Needs you lists waiting agents before stopped ones
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "ask"
    Then the chat shows a question
    When I open the "claude" agent on node "order"
    And the node agent's fold is ready
    And I ask the agent "hold"
    Then the agent "order" stands "working"
    And the Recent row "order" draws the "working…" dot before its age
    When the agent is released
    Then the agent is idle
    When I ask the agent "crash"
    Then the agent "order" stands "gone"
    And Needs you lists "install order"
    And the Needs you row "install" has waiting questions
    And the Needs you row "order" says "not running"
    And Recent lists "order install"
    And the Recent row "install" draws the "needs you" dot before its age
    And the Recent row "order" draws the "not running" dot before its age
    And there should be no page errors

  Scenario: Disabling chat withdraws both sidebar regions and its palette rows
    Given the sidebar has eleven agents with dated vault edits
    And I open the outline "recent.olai"
    When I open the plugins panel
    And I switch the plugin "chat" off
    Then the agent sidebar regions are absent
    When I press "Escape"
    And I press the palette shortcut
    And I type "Agents" into the palette
    Then the Agents palette lists 0 agents
    When I press "Escape"
    And I open the plugins panel
    And I switch the plugin "chat" on
    And I press "Escape"
    And I press the palette shortcut
    And I type "Agents" into the palette
    Then the Agents palette lists 11 agents
    When I press "Escape"
    Then the agents roster holds 10 agents
    And there should be no page errors
