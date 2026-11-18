@scratch:chat
Feature: A note's chat travels with the file, and every page is whole without chat
  The tie is written in the note itself, so it goes where the note goes: rename
  the file on disk and the chat is still that note's — under its new name, in
  every list, and in the line at the top of its page. Delete the note and the
  chat is gone with it, because the conversation was never anywhere else.

  And when chat is switched off every page is whole: no line, no door, nothing
  left behind. Switched on again, both come back to the note that had them.

  Scenario: Renaming a note while its agent is answering keeps the chat
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "before it moved"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the agent has answered "before it moved" exactly once
    # THE FILE MOVES WHILE A TURN IS IN FLIGHT, which is the case worth
    # testing: a rename against a chat that was sitting idle proves nothing
    # about the hard one. The agent holds this turn, and the standing says so
    # — read off the roster, where every face reads it.
    When I ask the agent "hold"
    Then the agent is working
    And the agent "plan-chat" stands "working"
    When I open the outline "house.olai"
    And the file "notes/plan.md" is renamed to "notes/blueprint.md"
    # THE TIE TRAVELS WITH THE FILE: it was written in the front matter, so the
    # rename carried it, and the chat is listed under the new name.
    Then the note "notes/blueprint.md" carries a chat as "blueprint-chat"
    And the Chats row "blueprint-chat" reads "blueprint" with a file mark
    And there is no Chats row for the note "notes/plan.md"
    # THE SEAT DOES NOT TRAVEL WITH IT, and that is the other half of the same
    # rule: a note's agent is taught the path it was started on and the note
    # itself is its memory, so a file that moved frees the seat rather than
    # leaving a process answering about a name nothing holds. The chat is the
    # new note's, asleep, and nothing of it was thrown away.
    And the agent "blueprint-chat" stands "asleep"
    # PRESSING THE ROW OPENS THE CHAT, which is what a press on a Chats row
    # has always done (`./focus.ts`): the conversation's own page comes
    # forward, named by the note under its new name, carries on where it left
    # off, and can be talked to where it is drawn.
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
    When I open the outline "house.olai"
    And the file "notes/plan.md" is deleted
    Then there is no Chats row for the note "notes/plan.md"
    And there should be no page errors

  Scenario: Chat switched off takes the line and every door with it, and switched on brings them back
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the document "notes/plan.md"
    Then the line stands on the chat "plan-chat"
    When I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    Then the page has no chat line
    And the document open is "notes/plan.md"
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    # ... and a page that never had a chat is whole too: no box, no line.
    And I open the outline "house.olai"
    Then the page has no chat line
    When I open the plugins panel
    And I switch the plugin "chat" on
    And I close the plugins panel
    # Chat came back on a fresh activation, and the line is drawn from the
    # roster again — still reading nothing, still waking nobody.
    When I open the document "notes/plan.md"
    Then the note line is about the note "notes/plan.md"
    And the line stands on the chat "plan-chat"
    When I open the chat from the line
    Then the chat page conversation is ready
    And there should be no page errors
