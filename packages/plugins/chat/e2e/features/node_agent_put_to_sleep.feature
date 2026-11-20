@scratch:chat
Feature: Putting one agent to sleep hands its seat back and keeps the chat
  Eight node agents may be awake at once. Until now the only verb that freed
  one of those seats by hand was *Close the chat*, which does something else
  entirely — it takes the tie off the node, and the conversation is listed
  nowhere afterwards. *Put to sleep* is the verb for the thing a person
  actually wants: stop this agent, give its seat back, leave the chat where it
  is. It lives on the `•••` of a Chats row, so it can be pressed from the
  column that shows which agents are awake, without opening the chat at all.

  Scenario: Put to sleep from the Chats row, and the chat is still there after a restart
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "order"
    And the node agent's fold is ready
    And I ask the agent "the order is placed"
    Then the agent has answered "the order is placed" exactly once
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "the cabinets are in"
    Then the agent has answered "the cabinets are in" exactly once
    And I remember this conversation as "cabinets"
    And Chats lists "install order"
    And the Chats row "install" wears the "Idle" dot
    And the Chats row "order" wears the "Idle" dot
    When I open the outline "yard.olai"
    And I open the Chats menu of "install"
    Then the Chats menu offers "Put to sleep, Tidy memory, Close the chat"
    When I choose "Put to sleep" from the Chats menu
    Then the agent "install" stands "asleep"
    And the Chats row "install" wears no dot
    And Chats lists "order install"
    And the agents roster holds 2 agents
    When I reload the page
    Then the agent "install" stands "asleep"
    When the server stops
    And the server starts again on the same port
    And I open the app
    Then the agents roster holds 2 agents
    And the agent "install" stands "asleep"
    When I press the agent "install"
    Then the panel is in the remembered conversation "cabinets"
    And the agent has answered "the cabinets are in" exactly once
    When I ask the agent "and the handles after that"
    Then the agent has answered "and the handles after that" exactly once
    And the agent has answered "the cabinets are in" exactly once
    And there should be no page errors

  Scenario: Putting a working agent to sleep stops the turn it is in the middle of
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "hold"
    Then the agent "install" stands "working"
    When I open the outline "yard.olai"
    And I open the Chats menu of "install"
    And I choose "Put to sleep" from the Chats menu
    Then the agent "install" stands "asleep"
    And the held agent process has exited
    And there should be no page errors

  Scenario: Putting a waiting agent to sleep discards the question it was holding
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "ask"
    Then the chat shows a question
    When I open the outline "yard.olai"
    Then Needs you lists "install"
    When I open the Chats menu of "install"
    And I choose "Put to sleep" from the Chats menu
    Then the agent "install" stands "asleep"
    And Needs you is absent
    And there should be no page errors

  Scenario: A chat that is already asleep is not offered the verb
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "the cabinets are in"
    Then the agent has answered "the cabinets are in" exactly once
    When I open the outline "yard.olai"
    And I open the Chats menu of "install"
    And I choose "Put to sleep" from the Chats menu
    Then the agent "install" stands "asleep"
    When I open the Chats menu of "install"
    Then the Chats menu offers "Tidy memory, Close the chat"
    And there should be no page errors
