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
    Then the zoomed node is "recent-0"
    And the node page conversation is ready for "recent-0"
    When I ask the agent "palette reached the oldest agent"
    Then the agent has answered "palette reached the oldest agent" exactly once
    And the Chats row "recent-0" is current
    And the agent "recent-0" stands "idle"
    And there should be no page errors

  Scenario: An unbound palette row opens a page of its own without a conversation
    Given the sidebar has eleven agents with dated vault edits
    And I open the outline "house.olai"
    When I press the palette shortcut
    And I type "Agents" into the palette
    And I pick the Agents palette row "recent-1"
    Then the zoomed node is "recent-1"
    And the node page offers no conversation
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

  # THE REPORT (this scenario is its regression): a conversation filed under
  # _olai/Inbox.olai's `chats` container opened the INBOX with the chat's row
  # merely selected. The row must lead to the conversation's own page, whose
  # trail roots at the file that holds the node — not at the file the reader
  # happened to be on.
  Scenario: A chat filed under the Inbox opens its own page, not the Inbox
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "filed under chats"
    And I send the new chat draft
    Then the chat child under "chats" in "_olai/Inbox.olai" is titled "filed under chats"
    When I open the outline "house.olai"
    And I open the filed "claude" conversation "filed under chats" as node "filed"
    Then the conversation "filed" is the root of the page
    And the breadcrumbs are "_olai/Inbox.olai, Chats"
    And the node page conversation is ready for "filed"
    And there should be no page errors

