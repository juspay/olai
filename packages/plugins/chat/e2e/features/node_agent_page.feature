@agent-review @scratch:chat
Feature: A node's page holds its memory and conversation
  Scenario: Opening the page keeps the fold's draft and puts memory before conversation
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I type "keep this cabinet draft" into the chat
    And I follow the agent's open-page link
    Then the zoomed node is "install"
    And the node page conversation is ready for "install"
    And the chat input reads "keep this cabinet draft"
    And the agent page puts its line before properties and memory before conversation
    And the node "install" shows the property "chat-agent-session" holding "claude:fake-session-1"
    When I send the chat message
    Then the agent has answered "keep this cabinet draft" exactly once
    And there should be no page errors

  Scenario Outline: Sending from a plain node starts its agent and delivers the queued message on <screen>
    Given I open the plain node composer for "install"
    Then the plain node composer says "ask about install the cabinets…" and "memory: this subtree (2 rows)"
    When I send "done hinges" from the plain node composer
    Then the node page conversation is ready for "install"
    And the agent is idle
    And "house.olai" holds a node marked done titled "pick the hinges"
    And the node "install" shows the property "chat-agent-session" holding "claude:fake-session-1"
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |

    @phone
    Examples:
      | screen |
      | phone  |

  Scenario: A held opening keeps its page-owned message until the new composer arrives
    Given I open the plain node composer for "install"
    When the next agent boot will hang
    And I send "queued on the page" from the plain node composer
    Then the plain node composer is starting
    When the agent is released
    Then the node page conversation is ready for "install"
    And the agent has answered "queued on the page" exactly once
    And there should be no page errors

  @codex
  Scenario: A plain page uses the chosen engine
    Given I open the plain node composer for "install"
    When I choose "codex" in the plain node composer
    And I send "page engine choice" from the plain node composer
    Then the node page conversation is ready for "install"
    And the header names the agent "codex"
    And the agent has answered "page engine choice" exactly once
    And the node "install" shows the property "chat-agent-session" holding "codex:fake-session-1"

  Scenario: A page transcript grows beyond a fold's height and the pane follows its newest line
    Given I open the plain node composer for "install"
    When I send "hello" from the plain node composer
    Then the node page conversation is ready for "install"
    And the agent is idle
    When I ask for a tall page answer
    Then the agent is idle
    And the page transcript is unbounded and its composer is on screen

  @node-idle-fast
  Scenario: Leaving the page releases both slot faces' shared reading
    Given the harness keeps distinct sessions on disk
    And I open the plain node composer for "install"
    When I send "store this page conversation" from the plain node composer
    Then the node page conversation is ready for "install"
    And the agent is idle
    When I open the outline "yard.olai"
    Then the agent "install" stands "asleep"

  @no-agent
  Scenario: A plain page with no installed engine starts nothing
    Given I open the plain node composer for "install"
    Then the plain node composer has no available engine
    And the agent start pill on "install" is absent
    And there should be no page errors

  Scenario Outline: Fresh start and writable history share the page on <screen>
    Given the harness keeps distinct sessions on disk
    And I open the plain node composer for "install"
    When I send "page first session" from the plain node composer
    Then the node page conversation is ready for "install"
    And the agent has answered "page first session" exactly once
    When I remember this conversation as "first"
    Then the page has fresh start above its fold history
    When I start a fresh session
    Then the panel has a different conversation from "first"
    And the chat is empty
    When I ask the agent "page current session"
    Then the agent has answered "page current session" exactly once
    When I remember this conversation as "current"
    And I open the fold history
    Then the panel says this agent has had 1 past session
    When I open the past session "page first session"
    Then the panel is in the remembered conversation "first"
    When I ask the agent "done hinges"
    Then the agent is idle
    And "house.olai" holds a node marked done titled "pick the hinges"
    And node "install" still binds remembered conversation "current" in "house.olai"
    When I return to the node agent's current session
    Then the panel is in the remembered conversation "current"
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |

    @phone
    Examples:
      | screen |
      | phone  |


  @scroll-review
  Scenario: A split agent page pins its head and composer around one scroll
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    And I send "hello" from the plain node composer
    Then the node page conversation is ready for "install"
    When I ask for a tall page answer
    Then the agent is idle
    And pane 1 has one agent page scroller with pinned head and send
    When I resize the split window to 1600 by 600
    Then the split workspace stays within the window
    When I resize the split window to 1600 by 1000
    Then the split workspace stays within the window
    When I scroll pane 1 to the bottom
    And I ask the agent "hold"
    Then pane 1 follows new agent text at the bottom
    When I scroll pane 1 back to its memory
    Then the agent page memory is visible below its pinned head
    And pane 1 stays on its memory while the agent streams
    When the agent is released
    Then the agent is idle
    When I ask the agent "subagent"
    And I open the agent's work from the transcript
    Then the agent's work shows 2 calls
    And the page's agent shelf uses the pane scroll
    And pane 1 has one agent page scroller with pinned head and send
    And the split workspace stays within the window

  @node-idle-fast
  Scenario: Rebuilding chat releases an open fold and its reading
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "keep this conversation"
    Then the agent is idle
    When I open the plugins panel
    And I switch the plugin "chat" off
    Then no agent fold is open
    When I switch the plugin "chat" on
    And I press "Escape"
    Then the agent "install" stands "asleep"
    And no agent fold is open


  Scenario: Trashing a working agent stops its process and removes its standing
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "hold"
    Then the agent "install" stands "working"
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then the agents roster holds 0 agents
    And no agent fold is open
    And the held agent process has exited
