@scratch:chat
Feature: Putting one agent to sleep hands its seat back and keeps the chat
  Eight node agents may be awake at once. Until now the only verb that freed
  one of those seats by hand was *Close the agent*, which does something else
  entirely — it takes the binding off the node and the chat becomes an
  unclaimed one. *Put to sleep* is the verb for the thing a person actually
  wants: stop this agent, give its seat back, leave the chat exactly where it
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
    # BOTH ARE AWAKE, and both wear the dot that says so. `install` spoke last,
    # so it leads — which is what makes the move below visible.
    And Chats lists "install order"
    And the Chats row "install" wears the "Idle" dot
    And the Chats row "order" wears the "Idle" dot
    # THE CHAT IS NOT ON SCREEN when the verb is pressed, and that is the point
    # of putting it in the sidebar: a person who has been refused a ninth agent
    # is looking at the column, not at the chat they are done with.
    When I open the outline "yard.olai"
    And I open the Chats menu of "install"
    Then the Chats menu offers "Put to sleep, Tidy memory, Close the agent"
    When I choose "Put to sleep" from the Chats menu
    Then the agent "install" stands "asleep"
    And the Chats row "install" wears no dot
    # ...AND IT SORTS BELOW WHAT IS AWAKE, whatever it last said: `install` is
    # still the newest speech in this directory and is now the second row.
    And Chats lists "order install"
    # THE BINDING IS UNTOUCHED — this is the whole difference from closing the
    # agent, and the restart is what proves it is on disk rather than in a tab.
    And the agents roster holds 2 agents
    When I reload the page
    Then the agent "install" stands "asleep"
    When the server stops
    And the server starts again on the same port
    And I open the app
    Then the agents roster holds 2 agents
    And the agent "install" stands "asleep"
    # ...AND OPENING IT CONTINUES THE CONVERSATION, rather than starting one.
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
    # NOBODY RELEASES THE TURN: the verb is what ends it. An agent that went on
    # thinking after its seat was handed back would be a subprocess nothing
    # owns, which is the one thing a seat is a seat for.
    When I open the outline "yard.olai"
    And I open the Chats menu of "install"
    And I choose "Put to sleep" from the Chats menu
    Then the agent "install" stands "asleep"
    # ...AND THE PROCESS IS GONE, which is the half a standing cannot claim: a
    # row can read `asleep` while a subprocess nobody owns goes on thinking.
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
    # A QUESTION IS A TURN THAT HAS NOT MOVED, so a chat that went to sleep
    # still owing one would leave a *Needs you* row for an answer nothing is
    # waiting for. The questions are withdrawn with the process.
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
    # NOTHING TO HAND BACK IS NOTHING TO OFFER. A verb drawn on a row where it
    # could only be refused teaches a person nothing; the other two stay.
    When I open the Chats menu of "install"
    Then the Chats menu offers "Tidy memory, Close the agent"
    And there should be no page errors
