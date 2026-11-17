@scratch:chat
Feature: A note's chat travels with the file, and every page is whole without chat
  The tie is written in the note itself, so it goes where the note goes: rename
  the file on disk and the chat is still that note's — under its new name, in
  every list, and at the foot of its page. Delete the note and the chat is gone
  with it, because the conversation was never anywhere else.

  And when chat is switched off every page is whole: no seat, no door, nothing
  left behind. Switched on again, both come back to the note that had them.

  Scenario: Renaming a note on disk keeps its chat
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "before it moved"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the seat agent has answered "before it moved" exactly once
    When I close the agent panel
    And I open the outline "house.olai"
    And the file "notes/plan.md" is renamed to "notes/blueprint.md"
    # THE TIE TRAVELS WITH THE FILE: it was written in the front matter, so the
    # rename carried it, and the chat is listed under the new name.
    Then the note "notes/blueprint.md" carries a chat as "blueprint-chat"
    And the Chats row "blueprint-chat" reads "blueprint" with a file mark
    And there is no Chats row for the note "notes/plan.md"
    # PRESSING THE ROW OPENS THE CHAT, which is what a press on a Chats row
    # has always done (`./focus.ts`): the conversation's own page comes
    # forward, named by the note under its new name, and can be talked to
    # where it is drawn.
    When I press the Chats row "blueprint-chat"
    Then the chat page is about the note "notes/blueprint.md" named "blueprint"
    And the chat page conversation is ready
    When I ask the agent "after it moved"
    Then the agent has answered "after it moved" exactly once
    And there should be no page errors

  Scenario: A note that is deleted takes its chat with it
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "before it went"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    When I close the agent panel
    And I open the outline "house.olai"
    And the file "notes/plan.md" is deleted
    Then there is no Chats row for the note "notes/plan.md"
    And there should be no page errors

  Scenario: Chat switched off takes the seat and every door with it, and switched on brings them back
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "before the flip"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
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
    # Chat came back on a fresh activation, so this tab remembers no open
    # seat: the note's fold is shut again until it is pressed.
    When I open the document "notes/plan.md"
    Then the page seat is about the note "notes/plan.md"
    And the seat is folded on the chat "plan-chat"
    When I open the seat's chat
    Then the seat holds the conversation "plan-chat"
    And there should be no page errors
