@scratch:chat
Feature: A note's chat is named, opened and lit by its note
  A chat that belongs to a note is listed under the note's own name, wearing
  the mark that kind of file wears — in the sidebar's Chats, the side panel's
  title and picker, and the palette, whose second line says where the note is.
  Pressing such a row opens the NOTE, and the row is lit exactly while that
  note is the page in front.

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

  Scenario: The side panel's picker names it the same way
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "theirs"
    And I open the outline "house.olai"
    Then the Chats row "theirs" reads "plan" with a file mark
    When I press the agent panel toggle
    Then the panel picker row "theirs" reads "plan" with a file mark
    And there should be no page errors

  Scenario: Pressing the Chats row opens the note, and the row is lit there and nowhere else
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "open me later"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    # COLD, so this tab remembers no open seat: what follows is the press on
    # the Chats row doing the opening.
    When I open the address "/"
    Then the Chats row "plan-chat" is not current
    When I press the Chats row "plan-chat"
    Then the document open is "notes/plan.md"
    And the Chats row "plan-chat" is current
    And the seat is not folded
    And the seat holds the conversation "plan-chat"
    When I open the outline "house.olai"
    Then the Chats row "plan-chat" is not current
    And there should be no page errors

  # A NODE'S CHAT IS STILL A NODE'S: it reads its row's title and wears no file
  # mark, which is the other half of the same promise.
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
    # A MARK COSTS A ROW NO HEIGHT. A kind's glyph draws itself into whatever
    # box its caller gives it, so one drawn in no box takes the whole row — a
    # palette row for a chat about a document was six hundred points tall. The
    # claim is a comparison, because "a row is 36px" is a number a theme owns.
    And the Chats row "plan-chat" is no taller than the row "install"
    When I press the palette shortcut
    And I type "Agents" into the palette
    Then the Agents palette row "plan-chat" is no taller than the row "install"
    And there should be no page errors
