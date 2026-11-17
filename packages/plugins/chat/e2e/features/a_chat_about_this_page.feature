@scratch:chat
Feature: A chat about the page in front
  A conversation can be ABOUT anywhere olai can open — a document, a table, a
  whole outline — and not only about an outline row. The page says where it is
  at its foot (the seat), chat fills that seat, and where there is no chat yet
  it offers one: a box, the side panel's **This page** block, and a palette row
  under New chat. All three start the same thing — a chat row filed under
  Inbox › Chats, titled `[name](address)`, with the first message delivered
  once — and all three go away the moment that page has a chat.

  Scenario Outline: A document with no chat offers one, and the seat holds what it started on <screen>
    Given the vault holds "notes/plan.md" saying "# Plan\n\nThe cabinets land on Tuesday."
    And I open the document "notes/plan.md"
    Then the document open is "notes/plan.md"
    And the page seat is about "file:notes/plan.md"
    And the seat offers to chat about "plan"
    And the seat says "Sending starts a chat about this page · it is filed under Inbox › Chats"
    When I ask about this page "when do the cabinets land"
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
    And the Inbox has 1 filed conversations
    And the seat holds the conversation "plan-chat"
    # ONCE: the server delivers the door's first message, and a second delivery
    # would draw a second answer under the same words.
    And the seat agent has answered "when do the cabinets land" exactly once
    # ... and with a chat here there is no door left on this page.
    And the seat offers no chat box
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario: The side panel offers This page, and what it starts is docked beside the page
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I press the agent panel toggle
    Then the side panel offers This page "file:notes/plan.md" named "plan" at "notes/plan.md"
    When I ask about this page in the panel "what is left to decide"
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
    And the agent panel shows "plan-chat"
    And the agent panel title reads "plan" with a place mark
    And the agent panel's conversation is ready
    And the agent's answer mentions "you said: what is left to decide"
    # The same conversation under the page, because it is the same chat.
    And the seat holds the conversation "plan-chat"
    And the side panel offers no This page
    And there should be no page errors

  Scenario: The palette is the third door, and it closes once this page has a chat
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I press the palette shortcut
    Then the palette offers a chat about this page
    When I open chat about this page from the palette
    Then the palette placeholder is "Ask about plan…"
    And the palette footer mentions "Start chat"
    When I type "which hinges did we pick" into the palette
    And I press the palette submit
    # The server delivers the first message before it answers, so the level is
    # still up while that turn runs: the chat on disk is what says it landed.
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
    And the command palette is closed
    And the seat holds the conversation "plan-chat"
    And the seat agent has answered "which hinges did we pick" exactly once
    When I press the palette shortcut
    Then the palette offers no chat about this page
    And there should be no page errors

  # A PLACE HAS ONE CHAT, and the door is what keeps it that way: the moment
  # somebody else's tab (or a `git pull`) files a chat about this page, every
  # door here withdraws rather than offering a second one. (The refusal the
  # server answers a racing send with is `new-chat.test.ts`'s: no door is left
  # on screen to press by the time the roster has moved.)
  Scenario: A chat filed from somewhere else closes every door on this page
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I press the agent panel toggle
    Then the side panel offers This page "file:notes/plan.md" named "plan" at "notes/plan.md"
    When another writer files a chat about "/notes/plan.md" in "house.olai" as "theirs"
    Then the seat stops saying "No chat yet"
    And the side panel offers no This page
    When I press the palette shortcut
    Then the palette offers no chat about this page
    And the Inbox contains no chat children
    And there should be no page errors

  Scenario: The agent is told which page the conversation is about, and a plain chat is told what it always was
    Given the harness keeps distinct sessions on disk
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "read it and tell me"
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
    And the seat holds the conversation "plan-chat"
    And the seat's first message says it is about "/notes/plan.md"
    # ... and WHOSE node agent it still is, which is where its memory goes: the
    # chat row under the Inbox, not the document.
    And the seat's first message is the node agent for "plan-chat" in "_olai/Inbox.olai"
    When I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "an ordinary chat"
    And I send the new chat draft
    Then the chat child under "chats" in "_olai/Inbox.olai" is titled "an ordinary chat"
    And the conversation says it is about nothing
    And there should be no page errors

  # A KIND OLAI ONLY SHOWS is the same page as far as this is concerned: the
  # body page draws the seat, and the file wears its own kind's name — a `.csv`
  # keeps its suffix, because that is what olai calls it everywhere else.
  Scenario: A table has the same seat and the same door
    Given the vault holds "data/sales.csv" saying "month,sold\nJan,12\nFeb,15"
    When I open the address "/data/sales.csv"
    Then the document open is "data/sales.csv"
    And the page seat is about "file:data/sales.csv"
    And the seat offers to chat about "sales.csv"
    And the seat box offers the agents "claude"
    When I ask about this page "which month sold more"
    Then a chat titled "[sales.csv](/data/sales.csv)" is filed under Inbox Chats as "sales-chat"
    And the seat holds the conversation "sales-chat"
    And the seat agent has answered "which month sold more" exactly once
    And the Chats row "sales-chat" reads "sales.csv" with a place mark
    And there should be no page errors
