@scratch:chat
Feature: Live chats survive a restart
  # A SERVER THAT COMES BACK WITH ITS CONVERSATIONS ALREADY OPEN. A chat was
  # live when the process died; the next process re-opens it from the record it
  # wrote as they moved, before any browser connects. A page is not the thing
  # that remembers — otherwise "restart" would mean "the tab reopened whatever
  # it happened to be looking at", which is a browser fact, not the server's.
  #
  # The record holds node ids and the instant each was touched, and nothing
  # else: the node's own `agent-session` property is what names the
  # conversation, so a fresh start or a rebind is never resurrected by a stale
  # copy of the old one.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  Scenario: A live chat is open again before any browser asks
    Given the harness keeps distinct sessions on disk
    And the agent notes every conversation it loads
    And I open the outline "house.olai"
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "hello"
    Then the agent's answer mentions "you said: hello"
    And I remember this conversation as "kitchen"
    When the server stops
    And the server starts again on the same port
    # BEFORE `I open the app`, and that is the whole claim: the fake agent has
    # been handed the same session id with no page in existence to ask for it.
    Then the agent has loaded the conversation on node "kitchen" in "house.olai" without a browser
    When I open the app
    And I open the outline "house.olai"
    And I unfold node agent "kitchen"
    Then the panel is in the remembered conversation "kitchen"
    And the chat eventually shows "you said: hello"

  Scenario: A turn killed in flight leaves a conversation that is ready to use
    Given the agent notes every conversation it loads
    And I open the outline "house.olai"
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "slow"
    Then the agent is working
    # THE KILL IS THE POINT: `the server stops` is a SIGKILL of the server and
    # its agent, so nothing runs on the way out to write anything down. What
    # the next boot reads is the last write made while the turn was running.
    When the server stops
    And the server starts again on the same port
    Then the agent has loaded the conversation on node "kitchen" in "house.olai" without a browser
    When I open the app
    And I open the outline "house.olai"
    And I unfold node agent "kitchen"
    # NOT `working…`: the turn died with its process, and a panel that kept
    # the banner would be promising output from an agent that no longer exists.
    Then the agent is idle
    And the chat input takes typing
    When I type "hello" into the chat
    And I send the chat message
    Then the agent's answer mentions "you said: hello"

  Scenario: A conversation the agent refuses to resume is not live, and opens with its refusal
    Given the agent notes every conversation it loads
    And I open the outline "house.olai"
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And I remember this conversation as "kitchen"
    When the server stops
    # ARMED WHILE NO SERVER RUNS: the next `session/load` — which is the boot's
    # own — is answered with a refusal, the way an agent that lost its store
    # answers one.
    And the agent refuses to load a conversation
    And the server starts again on the same port
    And the filer's boot run has settled
    And I open the app
    And I open the outline "house.olai"
    Then node agent "kitchen" is folded
    When I unfold node agent "kitchen"
    # THE READER PATH IS UNCHANGED: no conversation is live, and opening the
    # node draws the refusal and its retry exactly as it does when a person
    # opens a stored conversation the agent cannot resume.
    Then the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "no such conversation"
    And there is nothing to type into

  @opencode
  Scenario: A conversation whose engine is switched off is not reopened
    Given the agent notes every conversation it loads
    And I open the outline "house.olai"
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I remember this conversation as "kitchen"
    When the server stops
    And I set the plugin "opencode" off on disk
    And the server starts again on the same port
    And the filer's boot run has settled
    And I open the app
    And I open the outline "house.olai"
    # The entry stays on the record — an engine that mounts later is what
    # `enginesMoved` is for — but nothing is asked of a row this serve has not
    # got, and no conversation comes back.
    Then node agent "kitchen" is folded
    And all bound node agents are asleep
    And the agent has not loaded the conversation on node "kitchen" in "house.olai"

  Scenario: A node trashed while the server was down is skipped quietly
    Given the agent notes every conversation it loads
    And I open the outline "house.olai"
    When I open the "claude" agent on node "order"
    And the node agent's fold is ready
    And I ask the agent "hello"
    Then the agent's answer mentions "you said: hello"
    When the server stops
    And I move node "order" in "house.olai" to the trash on disk
    And the server starts again on the same port
    And I open the app
    And I open the outline "house.olai"
    And the filer's boot run has settled
    Then the node "order" is not shown
    And the agent has not loaded the conversation on node "order" in "_olai/Trash.olai"
    And no agent fold is open
    And there should be no page errors
