@scratch:chat
Feature: A delayed tab cannot apply a chat control to another node's turn
  Scenario: Cancel in a delayed tab stops only its own node while another tab reads another
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the node agent's fold is ready
    And I ask the agent "ask"
    Then the chat shows a question
    And the agent is working
    When I hold incoming updates to the original browser tab
    And I open another browser tab
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the node agent's fold is ready
    And I ask the agent "ask"
    Then the chat shows a question
    And the agent is working
    When I use the original browser tab
    And I cancel the turn
    And I release incoming updates to the original browser tab
    Then the agent is idle
    When I use the other browser tab
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    When I press the agent "install"
    Then the agent is idle
    And there should be no page errors

  Scenario Outline: Sending from a delayed tab reaches its own node and preserves newer typing (<case>)
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the node agent's fold is ready
    And I pick "notes.txt" with the attach button
    Then the composer is holding "notes.txt", showing how big it is
    When I type "only for install" into the chat
    And I hold incoming updates to the original browser tab
    And I open another browser tab
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the node agent's fold is ready
    When I use the original browser tab
    And I send the chat message
    And I type "<next>" into the chat
    And I close the agent fold
    And I unfold node agent "install"
    And I release incoming updates to the original browser tab
    And the node agent's fold is ready
    Then the agent's answer mentions "read 5 bytes from notes.txt"
    And the chat input reads "<next>"
    And the composer is holding nothing
    When I press the agent "order"
    And the node agent's fold is ready
    Then the chat has not answered "you said: only for install"
    And the chat has not answered "read 5 bytes from notes.txt"
    And there should be no page errors

    Examples:
      | case                  | next            |
      | empty composer        |                 |
      | another draft started | follow-up draft |

  Scenario: The palette sends to its focused ancestor despite another tab reading another node
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the node agent's fold is ready
    And I point at row "hinges" in outline "house.olai"
    And I close the agent fold
    And I hold incoming updates to the original browser tab
    And I open another browser tab
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the node agent's fold is ready
    When I use the original browser tab
    And I press the palette shortcut
    And I type "> only for install" into the palette
    And I submit the palette while chat updates are delayed
    And I release incoming updates to the original browser tab
    Then node agent "install" is unfolded
    When I use the fold on node "install"
    Then the agent has answered "only for install" exactly once
    When I use the other browser tab
    Then the agent is idle
    And the chat has not answered "you said: only for install"
    And there should be no page errors

  Scenario: Retrying in a delayed tab resends only that node's refused message
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the node agent's fold is ready
    And I ask the agent "ready"
    Then the agent is idle
    When I ask the agent "refuse steering"
    Then the agent is idle
    When I ask the agent "hold"
    Then the agent is working
    When I interrupt the agent with "only for install"
    Then the chat shows my message "only for install" as "refused"
    When the agent is released
    Then the agent is idle
    When I hold incoming updates to the original browser tab
    And I open another browser tab
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the node agent's fold is ready
    And I ask the agent "ready"
    Then the agent is idle
    When I ask the agent "refuse steering"
    Then the agent is idle
    When I ask the agent "hold"
    Then the agent is working
    When I interrupt the agent with "only for order"
    Then the chat shows my message "only for order" as "refused"
    When I use the original browser tab
    And I send the undelivered message again
    And I release incoming updates to the original browser tab
    Then the agent's answer mentions "you said: only for install"
    When I use the other browser tab
    Then the chat shows my message "only for order" as "refused"
    When the agent is released
    Then the agent is idle
    When I send the undelivered message again
    Then the agent's answer mentions "you said: only for order"
    When I press the agent "install"
    And the node agent's fold is ready
    Then the agent has answered "only for install" exactly once
    And there should be no page errors


  Scenario: Delayed send acceptance cannot make the previous idle frame finish a turn
    Given incoming updates to this browser tab can be held
    And I open the app
    And I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I hold incoming updates to the original browser tab
    And I ask the agent "ready"
    Then the model picker is disabled
    When I release incoming updates to the original browser tab
    Then the agent is idle
    When I ask the agent "refuse steering"
    Then the agent is idle
    When I ask the agent "hold"
    Then the agent is working
    When I interrupt the agent with "retained steering"
    Then the chat shows my message "retained steering" as "refused"
    When the agent is released
    Then the agent is idle
    And there should be no page errors
