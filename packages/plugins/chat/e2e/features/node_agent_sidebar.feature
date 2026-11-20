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
    Then pane 0 is showing "/chat/recent-0"
    And the chat page conversation is ready
    When I ask the agent "palette reached the oldest agent"
    Then the agent has answered "palette reached the oldest agent" exactly once
    And the Chats row "recent-0" is current
    And the agent "recent-0" stands "idle"
    And Chats lists "recent-0 recent-10 recent-9 recent-8 recent-7 recent-6 recent-5 recent-4 recent-3 recent-2"
    And the Chats row "recent-0" wears the "Idle" dot
    And the Chats row "recent-10" wears no dot
    And there should be no page errors

  Scenario: An unbound palette row opens its chat page with the door on it
    Given the sidebar has eleven agents with dated vault edits
    And I open the outline "house.olai"
    When I press the palette shortcut
    And I type "Agents" into the palette
    And I pick the Agents palette row "recent-1"
    Then pane 0 is showing "/chat/recent-1"
    And the chat page offers to chat about "Chats agent 1"
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
    And Chats lists "install order"
    And the agent "install" stands "needs-you"
    And the agent "order" stands "gone"
    And the Chats row "install" wears the "Needs you" dot
    And the Chats row "order" wears no dot
    When I open the Chats menu of "order"
    Then the Chats menu offers "Put to sleep, Tidy memory, Close the chat"
    When I choose "Put to sleep" from the Chats menu
    Then the agent "order" stands "asleep"
    When I press the Needs you row "install"
    Then the address is "/chat/install"
    And the chat page is about the node "install" named "install the cabinets" in "house.olai"
    And the Chats row "install" is current
    And the panel is open at the question
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

  Scenario: A chat's row opens its own page, not the file the reader is on
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type "gate" into the palette
    And I choose the new chat item "gate"
    And I type new chat draft "about the gate"
    And I send the new chat draft
    Then the item "gate" carries a chat on "claude"
    When I open the outline "house.olai"
    And I press the Chats row "gate"
    Then the chat page is about the node "gate" named "oil the gate hinge" in "yard.olai"
    And the chat page conversation is ready
    And there should be no page errors

  @phone
  Scenario: A wide touch screen draws a Chats row's ••• and a thumb opens it
    Given I open the outline "house.olai"
    When I widen the window to a desk
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the Chats ••• of "install" is drawn without a hover
    When I tap the Chats ••• of "install"
    And I choose "Put to sleep" from the Chats menu
    Then the agent "install" stands "asleep"
    And there should be no page errors

