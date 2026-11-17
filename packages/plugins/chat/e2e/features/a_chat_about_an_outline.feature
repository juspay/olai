@scratch:chat
Feature: A chat about a whole outline
  An outline's page is a place like any other: the frame passes its FILE, so
  the home address `/` and a landing like `house.olai#install` are that same
  outline and share its chat. A chat about the file is not a chat about any row
  in it — a row's own conversation still unfolds under that row, and the two
  are drawn on the same page at once.

  Scenario Outline: The outline's page offers a chat about the file on <screen>
    Given I open the outline "house.olai"
    Then the page seat is about "file:house.olai"
    And the seat offers to chat about "house"
    When I ask about this page "what is left in the kitchen"
    Then a chat titled "[house](/house.olai)" is filed under Inbox Chats as "house-chat"
    And the seat holds the conversation "house-chat"
    And the seat agent has answered "what is left in the kitchen" exactly once
    And the seat offers no chat box
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario: The home address and a row landing are the same outline, so they are the same chat
    Given I open the outline "house.olai"
    When I ask about this page "which cabinets go in first"
    Then a chat titled "[house](/house.olai)" is filed under Inbox Chats as "house-chat"
    And the seat holds the conversation "house-chat"
    # `/` names no file of its own; the frame that drew it says which outline it
    # turned out to be, and that is the place. Arriving cold, the seat is the
    # page's fold: it says the chat is there and reads nothing until pressed.
    When I open the address "/"
    Then the page seat is about "file:house.olai"
    And the seat is folded on the chat "house-chat"
    When I open the seat's chat
    Then the seat holds the conversation "house-chat"
    And the seat offers no chat box
    # ... and a landing inside the outline is the outline, not the row.
    When I open the address "/house.olai#install"
    Then the page seat is about "file:house.olai"
    And the seat is folded on the chat "house-chat"
    When I open the seat's chat
    Then the seat holds the conversation "house-chat"
    And there should be no page errors

  Scenario: A row's own chat still unfolds under its row, on the page the outline's chat sits at the foot of
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I ask about this page "the whole house"
    Then a chat titled "[house](/house.olai)" is filed under Inbox Chats as "house-chat"
    And the seat holds the conversation "house-chat"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "just this row"
    Then the agent's answer mentions "you said: just this row"
    And the page seat is about "file:house.olai"
    And the seat holds the conversation "house-chat"
    And the Inbox has 1 filed conversations
    And there should be no page errors
