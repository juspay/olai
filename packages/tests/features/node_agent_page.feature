@scratch:chat
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
