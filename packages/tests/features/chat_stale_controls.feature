@scratch:chat
Feature: A delayed tab cannot apply a chat control to another node's turn
  Scenario: Cancel from an outdated tab refuses instead of stopping the newly selected node
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "ask"
    Then the chat shows a question
    And the agent is working
    When I hold incoming updates to the original browser tab
    And I open another browser tab
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "ask"
    Then the chat shows a question
    And the agent is working
    When I use the original browser tab
    And I cancel the turn
    And I release incoming updates to the original browser tab
    Then the panel refuses, saying "the conversation changed"
    When I use the other browser tab
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    When I press the agent "install"
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    And there should be no page errors

  Scenario Outline: Sending from an outdated tab preserves the draft without messaging the other node (<case>)
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I pick "notes.txt" with the attach button
    Then the composer is holding "notes.txt", showing how big it is
    When I type "only for install" into the chat
    And I hold incoming updates to the original browser tab
    And I open another browser tab
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    When I use the original browser tab
    And I send the chat message
    And I type "<next>" into the chat
    And I close the agent panel
    And the agent panel is open
    And I release incoming updates to the original browser tab
    Then the panel refuses, saying "the conversation changed"
    And the chat input reads ""
    And the composer is holding nothing
    When I press the agent "install"
    And the agent panel is open
    Then the chat input reads "<recovered>"
    And the composer is holding "notes.txt", showing how big it is
    When I send the chat message
    Then the agent's answer mentions "read 5 bytes from notes.txt"
    When I press the agent "order"
    And the agent panel is open
    Then the chat has not answered "you said: only for install"
    And the chat has not answered "read 5 bytes from notes.txt"
    And there should be no page errors

    Examples:
      | case                  | next            | recovered                          |
      | empty composer        |                 | only for install                   |
      | another draft started | follow-up draft | only for install\nfollow-up draft |

  Scenario: The palette refuses to send to a node selected by another tab
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I minimize the agent panel
    And I hold incoming updates to the original browser tab
    And I open another browser tab
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    When I use the original browser tab
    And I press the palette shortcut
    And I type "> only for install" into the palette
    And I submit the palette while chat updates are delayed
    And I release incoming updates to the original browser tab
    Then the palette shows an ask error
    And the palette box holds "> only for install"
    When I use the other browser tab
    Then the agent is idle
    And the chat has not answered "you said: only for install"
    And there should be no page errors

  Scenario: Retrying a message from an outdated tab cannot resend another node's refused message
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
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
    And the agent panel is open
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
    Then the panel refuses, saying "the conversation changed"
    When I use the other browser tab
    Then the chat shows my message "only for order" as "refused"
    When the agent is released
    Then the agent is idle
    When I send the undelivered message again
    Then the agent's answer mentions "you said: only for order"
    When I press the agent "install"
    And the agent panel is open
    Then the chat shows my message "only for install" as "refused"
    When I send the undelivered message again
    Then the agent's answer mentions "you said: only for install"
    And there should be no page errors
