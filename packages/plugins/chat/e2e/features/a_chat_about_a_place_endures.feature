@scratch:chat
Feature: What becomes of a chat whose place went away, and of every page when chat does
  A chat row stands for a place only while olai still holds that place. Delete
  the file and the chat is an ordinary chat row again — still listed, still
  answering, on its own page — because the conversation never lived in the
  file: the row was only ever pointing at it.

  And when chat is switched off every page is whole: no seat, no door, nothing
  left behind. Switched on again, both come back to the page that had them.

  Scenario: A page that is deleted leaves its chat an ordinary chat row that still answers
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "before it went"
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
    And the seat agent has answered "before it went" exactly once
    When I close the agent panel
    And I open the outline "house.olai"
    And the file "notes/plan.md" is deleted
    Then the Chats row "plan-chat" reads "[plan](/notes/plan.md)" with no place mark
    When I press the Chats row "plan-chat"
    Then the conversation "plan-chat" is the root of the page
    And the node page conversation is ready for "plan-chat"
    When I ask the agent "after it went"
    Then the agent's answer mentions "you said: after it went"
    And there should be no page errors

  Scenario: Chat switched off takes the seat and every door with it, and switched on brings them back
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "before the flip"
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
    And the seat holds the conversation "plan-chat"
    When I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    Then the page has no chat seat
    And the document open is "notes/plan.md"
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    # ... and a page that never had a chat is whole too: no box, no seat.
    And I open the outline "house.olai"
    Then the page has no chat seat
    When I open the plugins panel
    And I switch the plugin "chat" on
    And I close the plugins panel
    Then the page seat is about "file:house.olai"
    And the seat offers to chat about "house"
    When I open the document "notes/plan.md"
    Then the page seat is about "file:notes/plan.md"
    And the seat holds the conversation "plan-chat"
    And there should be no page errors
