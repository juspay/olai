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
    # THE SEAT OPENS ITSELF for a chat started from its own door: a page never
    # wakes an agent on its own, but the person just started this one.
    And the seat is not folded
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
    # ... and the page did not open it: a chat it did not start is a folded
    # line until somebody presses it.
    And the seat is folded on the chat "theirs"
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

  # A REFUSED START KEEPS THE WORDS. The agent will not start, so there is no
  # conversation to put them in — and a box that cleared itself would have
  # thrown away the only copy. The row the attempt left under Inbox › Chats is
  # the row the next attempt starts on, so retrying never files a second one,
  # and what was docked beside the page is left exactly where it was.
  Scenario: A refused start keeps the words in the seat's box, files one row, and sends once when it can
    Given the harness keeps distinct sessions on disk
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the outline "house.olai"
    When I ask about this page "about the house"
    Then a chat titled "[house](/house.olai)" is filed under Inbox Chats as "house-chat"
    And the agent panel shows "house-chat"
    When I open the document "notes/plan.md"
    And the agent refuses to new a conversation
    And I ask about this page "what is left to decide"
    Then the chat box in the seat is refused with "this agent will not start a conversation in this directory"
    And the chat box in the seat holds "what is left to decide"
    # ... and nothing was docked over the conversation the reader had beside
    # the page.
    And the agent panel shows "house-chat"
    When I send the seat box again
    Then the chat box in the seat is refused with "this agent will not start a conversation in this directory"
    And the chat box in the seat holds "what is left to decide"
    And exactly 1 chat rows under Inbox Chats are titled "[plan](/notes/plan.md)"
    And a chat titled "[plan](/notes/plan.md)" waits under Inbox Chats as "plan-chat"
    When the agent will new a conversation again
    And I send the seat box again
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
    And exactly 1 chat rows under Inbox Chats are titled "[plan](/notes/plan.md)"
    And the seat holds the conversation "plan-chat"
    And the seat agent has answered "what is left to decide" exactly once
    And there should be no page errors

  Scenario: The palette's door keeps the words too, and its retry files no second row
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    And the agent refuses to new a conversation
    When I press the palette shortcut
    And I open chat about this page from the palette
    And I type "which hinges did we pick" into the palette
    And I press the palette submit
    Then the palette says "this agent will not start a conversation in this directory"
    And the new chat draft is "which hinges did we pick"
    And exactly 1 chat rows under Inbox Chats are titled "[plan](/notes/plan.md)"
    When the agent will new a conversation again
    And I press the palette submit
    Then a chat titled "[plan](/notes/plan.md)" is filed under Inbox Chats as "plan-chat"
    And exactly 1 chat rows under Inbox Chats are titled "[plan](/notes/plan.md)"
    And the command palette is closed
    And the seat holds the conversation "plan-chat"
    And the seat agent has answered "which hinges did we pick" exactly once
    And there should be no page errors

  # A START THAT STOPPED AT SIGN-IN is not a refusal: the chat row is there,
  # and what it is missing is a conversation. So the door closes — this page
  # has its chat — and the words wait for that row rather than going back
  # into the door's box. They are not sent by themselves: once somebody signs
  # in, they are in the conversation's composer, with a Send still to press.
  @claude @signin
  Scenario: A start that stops at sign-in keeps the words for the conversation the sign-in opens
    Given the agent needs a sign-in
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "sign in first"
    Then a chat titled "[plan](/notes/plan.md)" waits under Inbox Chats as "plan-chat"
    And the seat is not folded
    And the seat offers a sign-in
    When I press the seat's sign-in for "claude-ai-login"
    And I type "123456" into the seat's sign-in
    Then the seat holds the conversation "plan-chat"
    And the seat's composer reads "sign in first"
    # NOT SENT BY THEMSELVES: nothing was answered until the person pressed.
    And the seat agent has said nothing yet
    When I send from the seat's composer
    Then the seat agent has answered "sign in first" exactly once
    And the seat's composer reads ""
    And exactly 1 chat rows under Inbox Chats are titled "[plan](/notes/plan.md)"
    And there should be no page errors

  @claude @signin
  Scenario: The palette's door stops at the same sign-in, and files the same one row
    Given the agent needs a sign-in
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I press the palette shortcut
    And I open chat about this page from the palette
    And I type "sign in first" into the palette
    And I press the palette submit
    Then a chat titled "[plan](/notes/plan.md)" waits under Inbox Chats as "plan-chat"
    And the command palette is closed
    And the seat offers a sign-in
    When I press the seat's sign-in for "claude-ai-login"
    And I type "123456" into the seat's sign-in
    Then the seat holds the conversation "plan-chat"
    And the seat's composer reads "sign in first"
    And exactly 1 chat rows under Inbox Chats are titled "[plan](/notes/plan.md)"
    And there should be no page errors

  # OPENING A PAGE NEVER WAKES ITS AGENT. The seat is the page's fold: it says
  # how the chat there stands and nothing more until somebody presses it, so a
  # reader walking past a document does not start eight sleeping agents.
  Scenario: A page whose chat is asleep leaves it asleep until the seat's line is pressed
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer files a chat about "[plan](/notes/plan.md)" in "house.olai" as "theirs"
    And I open the document "notes/plan.md"
    Then the page seat is about "file:notes/plan.md"
    And the seat is folded on the chat "theirs"
    And the agent "theirs" stands "asleep"
    When I open the seat's chat
    Then the seat holds the conversation "theirs"
    And the agent "theirs" stands "idle"
    And there should be no page errors
