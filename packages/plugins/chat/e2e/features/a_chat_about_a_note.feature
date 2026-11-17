@scratch:chat
Feature: A chat about a note
  A conversation can be ABOUT a note — a `.md` file — and the tie lives in that
  note's own front matter: `chat-agent-session`, beside the prose, where a
  person can read it and a `git pull` carries it. Nothing is filed anywhere
  else. The note's page says so at its foot (the seat), chat fills that seat,
  and where there is no chat yet it offers one: a box, the side panel's **This
  page** block, and a palette row. All three start the same thing, with the
  first message delivered once, and all three go away the moment that note has
  a chat.

  Scenario Outline: A note with no chat offers one, and the seat holds what it started on <screen>
    Given the vault holds "notes/plan.md" saying "# Plan\n\nThe cabinets land on Tuesday."
    And I open the document "notes/plan.md"
    Then the document open is "notes/plan.md"
    And the page seat is about the note "notes/plan.md"
    And the seat offers to chat about "plan"
    And the seat says "the chat is kept in its front matter"
    And the seat never says "Inbox"
    When I ask about this page "when do the cabinets land"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And no chat is filed under the Inbox
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

  # ONE NOTE, ONE CHAT, and a second note has its own: the tie is a property of
  # the FILE, so two notes never share a conversation.
  Scenario: A second note has a chat of its own
    Given the harness keeps distinct sessions on disk
    And the vault holds "notes/plan.md" saying "# Plan"
    And the vault holds "notes/yard.md" saying "# Yard"
    And I open the document "notes/plan.md"
    When I ask about this page "about the plan"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the seat holds the conversation "plan-chat"
    When I open the document "notes/yard.md"
    Then the page seat is about the note "notes/yard.md"
    And the seat offers to chat about "yard"
    When I ask about this page "about the yard"
    Then the note "notes/yard.md" carries a chat as "yard-chat"
    And the seat holds the conversation "yard-chat"
    And the seat agent has answered "about the yard" exactly once
    And the note "notes/plan.md" carries a chat as "plan-chat"
    And there should be no page errors

  Scenario: The side panel offers This page, and what it starts is docked beside the page
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I press the agent panel toggle
    Then the side panel offers This page the note "notes/plan.md" named "plan"
    When I ask about this page in the panel "what is left to decide"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the agent panel shows "plan-chat"
    And the agent panel title reads "plan" with a file mark
    And the agent panel's conversation is ready
    And the agent's answer mentions "you said: what is left to decide"
    # The same conversation under the page, because it is the same chat.
    And the seat holds the conversation "plan-chat"
    And the side panel offers no This page
    And there should be no page errors

  Scenario: The palette is the third door, and it closes once this note has a chat
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
    # still up while that turn runs: the file on disk is what says it landed.
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the command palette is closed
    And the seat holds the conversation "plan-chat"
    And the seat agent has answered "which hinges did we pick" exactly once
    When I press the palette shortcut
    Then the palette offers no chat about this page
    And there should be no page errors

  # A NOTE HAS ONE CHAT, and the door is what keeps it that way: the moment
  # somebody else's tab (or a `git pull`) ties a chat to this note, every door
  # here withdraws rather than offering a second one.
  Scenario: A chat tied from somewhere else closes every door on this note
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I press the agent panel toggle
    Then the side panel offers This page the note "notes/plan.md" named "plan"
    When another writer ties a chat to the note "notes/plan.md" as "theirs"
    Then the seat stops saying "No chat yet"
    # ... and the page did not open it: a chat it did not start is a folded
    # line until somebody presses it.
    And the seat is folded on the chat "theirs"
    And the side panel offers no This page
    When I press the palette shortcut
    Then the palette offers no chat about this page
    And no chat is filed under the Inbox
    And there should be no page errors

  Scenario: The agent is told which note the conversation belongs to
    Given the harness keeps distinct sessions on disk
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "read it and tell me"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the seat holds the conversation "plan-chat"
    And the seat's first message names the note "notes/plan.md"
    And there should be no page errors

  # A REFUSED START KEEPS THE WORDS. The agent will not start, so there is no
  # conversation to put them in — and a box that cleared itself would have
  # thrown away the only copy. NOTHING IS WRITTEN INTO THE NOTE either: a
  # refusal is not a seat, so the person's file is left exactly as it was and
  # the door is still the door. Retrying from that same box ties the one chat.
  Scenario: A refused start keeps the words in the seat's box and sends once when it can
    Given the harness keeps distinct sessions on disk
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    And the agent refuses to new a conversation
    When I ask about this page "what is left to decide"
    Then the chat box in the seat is refused with "this agent will not start a conversation in this directory"
    And the chat box in the seat holds "what is left to decide"
    When I send the seat box again
    Then the chat box in the seat is refused with "this agent will not start a conversation in this directory"
    And the chat box in the seat holds "what is left to decide"
    And the note "notes/plan.md" has no chat
    When the agent will new a conversation again
    And I send the seat box again
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the seat holds the conversation "plan-chat"
    And the seat agent has answered "what is left to decide" exactly once
    And no chat is filed under the Inbox
    And there should be no page errors

  Scenario: The palette's door keeps the words too, and its retry ties no second chat
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    And the agent refuses to new a conversation
    When I press the palette shortcut
    And I open chat about this page from the palette
    And I type "which hinges did we pick" into the palette
    And I press the palette submit
    Then the palette says "this agent will not start a conversation in this directory"
    And the new chat draft is "which hinges did we pick"
    And the note "notes/plan.md" has no chat
    When the agent will new a conversation again
    And I press the palette submit
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the command palette is closed
    And the seat holds the conversation "plan-chat"
    And the seat agent has answered "which hinges did we pick" exactly once
    And there should be no page errors

  # A START THAT STOPPED AT SIGN-IN is not a refusal: the note's tie is there,
  # and what it is missing is a conversation. So the door closes — this note
  # has its chat — and the words wait for it rather than going back into the
  # door's box. They are not sent by themselves.
  @claude @signin
  Scenario: A start that stops at sign-in keeps the words for the conversation the sign-in opens
    Given the agent needs a sign-in
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "sign in first"
    Then the note "notes/plan.md" waits for a chat as "plan-chat"
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
    And there should be no page errors

  # OPENING A PAGE NEVER WAKES ITS AGENT. The seat is the note's fold: it says
  # how the chat there stands and nothing more until somebody presses it.
  Scenario: A note whose chat is asleep leaves it asleep until the seat's line is pressed
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "theirs"
    And I open the document "notes/plan.md"
    Then the page seat is about the note "notes/plan.md"
    And the seat is folded on the chat "theirs"
    And the agent "theirs" stands "asleep"
    When I open the seat's chat
    Then the seat holds the conversation "theirs"
    And the agent "theirs" stands "idle"
    And there should be no page errors

  # ...AND THE SAME LINE PUTS IT AWAY. The tab remembers the seat the way it
  # remembers a row's fold, so a seat that could only be opened would read the
  # conversation, and keep its agent awake, on every later visit to the page.
  Scenario: A seat folded again stays folded when its page is visited again
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "theirs"
    And I open the document "notes/plan.md"
    And I open the seat's chat
    Then the seat holds the conversation "theirs"
    When I fold the seat's chat
    Then the seat is folded on the chat "theirs"
    When I open the Chats menu of "theirs"
    And I choose "Put to sleep" from the Chats menu
    Then the agent "theirs" stands "asleep"
    # AWAY AND BACK IN THIS TAB, through the sidebar: a reload would answer
    # nothing at all, since what a tab remembers about its folds goes with it.
    When I click the document "finishes.md"
    Then the document open is "finishes.md"
    When I go back
    Then the document open is "notes/plan.md"
    And the page seat is about the note "notes/plan.md"
    And the seat is folded on the chat "theirs"
    And the agent "theirs" stands "asleep"
    And there should be no page errors

  # AN AGENT CANNOT SEAT ITSELF. `chat-agent-session` is a string-reserved key,
  # and the write fence refuses a document write that puts one into a note's
  # front matter (or takes one away) — so an agent can neither give itself a
  # chat nor drop its own tie.
  Scenario: An agent cannot write the tie into a note
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the app
    And a terminal agent is connected to the served directory
    When the terminal agent rewrites "notes/plan.md" expecting "# Plan\n", as "---\nchat-agent-session: claude:sneaky\n---\n# Plan\n"
    Then the terminal refusal says "notes/plan.md"
    And the note "notes/plan.md" has no chat
    And there should be no page errors
