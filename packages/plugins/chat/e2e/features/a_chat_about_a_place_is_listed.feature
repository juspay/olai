@scratch:chat
Feature: A chat about a place is named, opened and lit by that place
  A chat row standing for a place is never read as its raw title. Every list
  draws the place's own name and the place's own mark — the sidebar's Chats,
  the side panel's title and picker, the palette — and the palette says where
  the place is on its second line. Pressing such a row opens the PLACE, and the
  row is lit exactly where that place is the page in front.

  One chat stands for a place, and it is the first one: a second row carrying
  the same address is an ordinary chat row, with its own title and its own
  page.

  Scenario Outline: The sidebar and the palette name the place, never the title on <screen>
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "name this chat"
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
    And the Chats row "plan-chat" reads "plan" with a place mark
    And the Chats row "plan-chat" never says "[plan](/notes/plan.md)"
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
    And another writer files a chat about "/notes/plan.md" in "house.olai" as "theirs"
    And I open the outline "house.olai"
    Then the Chats row "theirs" reads "plan" with a place mark
    When I press the agent panel toggle
    Then the panel picker row "theirs" reads "plan" with a place mark
    And there should be no page errors

  Scenario: Pressing the Chats row opens the place, and the row is lit there and nowhere else
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "open me later"
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
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

  # THE DOOR IS OFFERED WHERE THERE IS A SEAT AND NO CHAT — and a day, the
  # agenda and the Trash have no seat at all.
  Scenario: Chat about this page is offered on a page with a seat, and on no other page
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I press the palette shortcut
    Then the palette offers a chat about this page
    When I press "Escape"
    And I open the day "2026-08-10"
    Then the page has no chat seat
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    And I open the agenda
    Then the page has no chat seat
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    And I open the Trash
    Then the page has no chat seat
    When I press the palette shortcut
    Then the palette offers no chat about this page
    And there should be no page errors

  Scenario: A second chat row carrying the same address is an ordinary chat
    Given the harness keeps distinct sessions on disk
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "the first one"
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
    And the seat holds the conversation "plan-chat"
    # A chat whose first message IS the address — a row somebody titled by hand.
    When I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "/notes/plan.md"
    And I send the new chat draft
    Then the chat child under "chats" in "_olai/Inbox.olai" is titled "/notes/plan.md"
    And the Chats row "new-chat" reads "/notes/plan.md" with no place mark
    And the Chats row "plan-chat" reads "plan" with a place mark
    # Arriving cold the seat is folded, and the chat behind it is the FIRST
    # row — the second one stands for nothing.
    When I open the document "notes/plan.md"
    Then the seat is folded on the chat "plan-chat"
    When I open the seat's chat
    Then the seat holds the conversation "plan-chat"
    When I press the Chats row "new-chat"
    Then the conversation "new-chat" is the root of the page
    And there should be no page errors

  # A MARK COSTS A ROW NO HEIGHT. A kind's glyph draws itself into whatever
  # box its caller gives it, so one drawn in no box takes the whole row — a
  # palette row for a chat about a document was six hundred points tall. The
  # claim is a comparison, because "a row is 36px" is a number a theme owns:
  # the row with a mark is the row without one.
  Scenario Outline: A place's mark leaves the row the height it had on <screen>
    Given the harness keeps distinct sessions on disk
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "about the plan"
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
    When I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "an ordinary chat"
    And I send the new chat draft
    Then the chat child under "chats" in "_olai/Inbox.olai" is titled "an ordinary chat"
    And the Chats row "plan-chat" is no taller than the row "new-chat"
    When I press the palette shortcut
    And I type "Agents" into the palette
    Then the Agents palette row "plan-chat" is no taller than the row "new-chat"
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |
