@node-agent-sidebar @scratch:chat
Feature: Agent activity is reachable from Chats and the palette
  Scenario: Chats caps every standing by activity and the palette reaches the oldest asleep agent
    Given the sidebar has eleven agents with dated vault edits
    And I open the outline "recent.olai"
    Then Chats lists "recent-10 recent-9 recent-8 recent-7 recent-6 recent-5 recent-4 recent-3 recent-2 recent-1"
    And Needs you is absent
    And the agent "recent-10" stands "asleep"
    And the agent "recent-1" stands "unbound"
    When I press the palette shortcut
    And I type "Agents" into the palette
    Then the Agents palette lists 11 agents
    When I pick the Agents palette row "recent-0"
    Then node agent "recent-0" is unfolded
    And the node agent's fold is ready
    When I ask the agent "palette reached the oldest agent"
    Then the agent has answered "palette reached the oldest agent" exactly once
    And the Chats row "recent-0" is current
    And the agent "recent-0" stands "idle"
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

  Scenario: Chats follows speech and Needs you lists waiting agents before stopped ones
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
    When the agent is released
    Then the agent is idle
    When I ask the agent "crash"
    And Needs you lists "install order"
    And the Needs you row "install" has waiting questions
    And the Needs you row "order" says "Not running"
    And Chats lists "order install"
    # ...AND EACH ROW'S STANDING IS DATA, in the order Chats puts them: the
    # question it is waiting on, and the agent that is not running. A Chats row
    # draws no dot for either (`Agents.tsx`), so the fact is the assertion.
    And the agent "install" stands "needs-you"
    And the agent "order" stands "gone"
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
