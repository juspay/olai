@scratch:chat
Feature: A note's chat is named, opened and lit by its note
  A chat that belongs to a note is listed under the note's own name, wearing
  the mark that kind of file wears — in the sidebar's Chats, on the chat's own
  page, and in the palette, whose second line says where the note is.
  Pressing such a row opens that chat's own page, and the row is lit exactly
  while that chat is the page in front.

  Scenario Outline: The sidebar and the palette name the note on <screen>
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "name this chat"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the Chats row "plan-chat" reads "plan" with a file mark
    When I press the palette shortcut
    And I type "Agents" into the palette
    Then the Agents palette row "plan-chat" reads "plan" placed "Agents · notes/plan.md"
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario: The chat's own page names it the same way
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "theirs"
    And I open the outline "house.olai"
    Then the Chats row "theirs" reads "plan" with a file mark
    When I open the Chats row "theirs" beside
    Then the chat page is about the note "notes/plan.md" named "plan"
    And there should be no page errors

  Scenario: Pressing the Chats row opens the chat, and the row is lit there and nowhere else
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "open me later"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    When I open the address "/"
    Then the Chats row "plan-chat" is not current
    When I press the Chats row "plan-chat"
    Then pane 0 is showing "/chat/notes/plan.md"
    And the chat page is about the note "notes/plan.md" named "plan"
    And the Chats row "plan-chat" is current
    And the chat page conversation is ready
    When I open the outline "house.olai"
    Then the Chats row "plan-chat" is not current
    And there should be no page errors

  Scenario: A node's chat is listed by its row's title, with no file mark
    Given the harness keeps distinct sessions on disk
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "about the plan"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    When I open the outline "house.olai"
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the Chats row "install" reads "install the cabinets" with no file mark
    And the Chats row "plan-chat" reads "plan" with a file mark
    And the Chats row "plan-chat" is no taller than the row "install"
    When I press the palette shortcut
    And I type "Agents" into the palette
    Then the Agents palette row "plan-chat" is no taller than the row "install"
    And there should be no page errors

  Scenario: A note's Chats menu offers no tidying
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page conversation is ready
    And the close control says "Close the chat. The tie comes off this note, and the conversation is listed nowhere in olai afterwards."
    When I open the Chats menu of "plan-chat"
    Then the Chats menu offers "Put to sleep, Close the chat"
    And there should be no page errors
