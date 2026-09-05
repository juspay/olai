@scratch:chat
Feature: Attachments belong to the live conversation, not to a drawer mount
  Uploading a file and sending it are separate user actions. Closing a drawer
  or rebuilding the page must not lose a completed or in-flight upload. A new
  conversation must not inherit files whose server-side lifetime has ended.

  Background:
    Given I open the app
    And the agent panel is open

  Scenario: Closing the drawer preserves a file until it is sent
    When I pick "Type 04-C.pdf" with the attach button
    Then the composer is holding "Type_04-C.pdf", showing how big it is
    When I type "what is this" into the chat
    And I close the agent panel
    And the agent panel is open
    Then the composer is holding "Type_04-C.pdf", showing how big it is
    And the chat input reads "what is this"
    When I send the chat message
    Then the agent's answer mentions "read 69 bytes from Type_04-C.pdf"
    And the composer is holding nothing
    When I close the agent panel
    And the agent panel is open
    Then the composer is holding nothing

  Scenario: An unrelated plugin change preserves multiple attachments
    When I drop "Type 04-C.pdf, notes.txt" on the chat panel
    Then the composer is holding "Type_04-C.pdf, notes.txt" in that order
    When I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And the agent panel is open
    Then the composer is holding "Type_04-C.pdf, notes.txt" in that order
    When I ask the agent "what are these"
    Then the agent's answer mentions "read 69 bytes from Type_04-C.pdf"
    And the agent's answer mentions "read 5 bytes from notes.txt"
    And the composer is holding nothing

  Scenario: A new conversation cannot send the previous conversation's attachments
    When I paste a picture called "old.png" into the chat
    Then the composer is holding the picture "old.png"
    When I start a new conversation
    Then the chat is empty
    And the composer is holding nothing
    When I close the agent panel
    And the agent panel is open
    Then the composer is holding nothing
    When I ask the agent "a new conversation"
    Then the agent's answer mentions "you said: a new conversation"
    And the chat shows no refusal

  Scenario: An attachment still being read finishes into the reopened drawer
    When reading the next attachment file is held
    And I drop "notes.txt" on the chat panel
    Then the attachment file is still being read
    When I close the agent panel
    And the agent panel is open
    And the attachment file read finishes
    Then the composer is holding "notes.txt", showing how big it is
    When I ask the agent "read the delayed attachment"
    Then the agent's answer mentions "read 5 bytes from notes.txt"
    And the composer is holding nothing

  Scenario: A delayed file read cannot upload into a new conversation
    When reading the next attachment file is held
    And I drop "notes.txt" on the chat panel
    Then the attachment file is still being read
    When I start a new conversation
    Then the chat is empty
    When the attachment file read finishes
    And I ask the agent "a conversation without the old file"
    Then the agent's answer mentions "you said: a conversation without the old file"
    And the composer is holding nothing

  @agent-stored
  Scenario: Restarting chat clears uploads even when it restores the same stored conversation
    When I remember this conversation as "stored"
    And I drop "notes.txt" on the chat panel
    Then the composer is holding "notes.txt", showing how big it is
    When I open the plugins panel
    And I switch the plugin "chat" off
    And I switch the plugin "chat" on
    And I close the plugins panel
    And the agent panel is open
    Then the panel is in the remembered conversation "stored"
    And the composer is holding nothing
    When I ask the agent "after chat restarted"
    Then the agent's answer mentions "you said: after chat restarted"
    And the chat shows no refusal

  Scenario: Each live node agent keeps only its own pending files when switching nodes
    Given the harness keeps distinct sessions on disk
    When I open the outline "house.olai"
    And I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "install the cabinets"
    When I remember this conversation as "cabinet"
    And I drop "Type 04-C.pdf" on the chat panel
    Then the composer is holding "Type_04-C.pdf", showing how big it is
    When I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "order the new cabinets"
    And the composer is holding nothing
    When I drop "notes.txt" on the chat panel
    Then the composer is holding "notes.txt" in that order
    When I press the agent "install"
    Then the panel is in the remembered conversation "cabinet"
    And the composer is holding "Type_04-C.pdf" in that order
    And the composer is holding "Type_04-C.pdf", showing how big it is
    When I ask the agent "read the cabinet attachment"
    Then the agent's answer mentions "read 69 bytes from Type_04-C.pdf"
    When I press the agent "order"
    Then the panel header names the node agent "order the new cabinets"
    And the composer is holding "notes.txt" in that order
    When I ask the agent "read the order attachment"
    Then the agent's answer mentions "read 5 bytes from notes.txt"

  Scenario: A removed file stays removed when the drawer is reopened
    When I drop "Type 04-C.pdf, notes.txt" on the chat panel
    Then the composer is holding "Type_04-C.pdf, notes.txt" in that order
    When I remove the pending attachment "Type_04-C.pdf"
    And I close the agent panel
    And the agent panel is open
    Then the composer is holding "notes.txt" in that order
    When I ask the agent "read only the remaining file"
    Then the agent's answer mentions "read 5 bytes from notes.txt"
    And the composer is holding nothing

  Scenario: An undelivered message keeps its attachment for retry after the drawer closes
    When I ask the agent "refuse busy"
    Then the agent's answer mentions "a second message while working will be refused from here on."
    And the agent is idle
    When I ask the agent "hold"
    Then the agent is working
    When I drop "notes.txt" on the chat panel
    Then the composer is holding "notes.txt" in that order
    When I ask the agent "read the retry attachment"
    Then the chat shows my message "read the retry attachment" as "refused"
    When I close the agent panel
    And I reopen the agent panel during a turn
    Then the composer is holding nothing
    When the agent is released
    Then the agent is idle
    When I send the undelivered message again
    Then the agent's answer mentions "read 5 bytes from notes.txt"
    And no message is marked undelivered

  Scenario: Identically named files on different nodes keep their own bytes and preview sizes
    Given the harness keeps distinct sessions on disk
    When I open the outline "house.olai"
    And I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "install the cabinets"
    When I attach a text file named "notes.txt" containing "first"
    Then the pending attachment "notes.txt" shows size "5 B"
    When I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "order the new cabinets"
    When I attach a text file named "notes.txt" containing "second-node"
    Then the pending attachment "notes.txt" shows size "11 B"
    When I press the agent "install"
    Then the panel header names the node agent "install the cabinets"
    And the pending attachment "notes.txt" shows size "5 B"
    When I ask the agent "read the first notes"
    Then the agent's answer mentions "read 5 bytes from notes.txt"
    When I press the agent "order"
    Then the panel header names the node agent "order the new cabinets"
    And the pending attachment "notes.txt" shows size "11 B"
    When I ask the agent "read the second notes"
    Then the agent's answer mentions "read 11 bytes from notes.txt"
