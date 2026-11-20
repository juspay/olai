@scratch:chat
Feature: A chat about a note
  A conversation can be ABOUT a note — a `.md` file — and the tie lives in that
  note's own front matter: `chat-agent-session`, beside the prose, where a
  person can read it and a `git pull` carries it. Nothing is filed anywhere
  else. The note's page says so in one line at the top: how its chat stands and
  the way into it, in the pane beside the page. Where there is no chat yet that
  line offers one — a box — and the palette offers a second door. Both start
  the same thing, with the first message delivered once, both open the
  conversation beside the note, and both go away the moment that note has a
  chat.

  Scenario Outline: A note with no chat offers one, and what it starts opens beside <screen>
    Given the vault holds "notes/plan.md" saying "# Plan\n\nThe cabinets land on Tuesday."
    And I open the document "notes/plan.md"
    Then the document open is "notes/plan.md"
    And the note line is about the note "notes/plan.md"
    And the line offers to chat about "plan"
    And the line never says "Inbox"
    When I ask about this page "when do the cabinets land"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And no chat is filed under the Inbox
    And the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    And the agent has answered "when do the cabinets land" exactly once
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario: The line says the chat is beside, and offers no box once there is one
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "when do the cabinets land"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the chat page conversation is ready
    When I focus pane 0
    Then the line stands on the chat "plan-chat"
    And the line says the chat is shown beside
    And the line offers no chat box
    And the conversation is drawn once
    And there should be no page errors

  Scenario: A second note has a chat of its own
    Given the harness keeps distinct sessions on disk
    And the vault holds "notes/plan.md" saying "# Plan"
    And the vault holds "notes/yard.md" saying "# Yard"
    And I open the document "notes/plan.md"
    When I ask about this page "about the plan"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the chat page is about the note "notes/plan.md" named "plan"
    When I focus pane 0
    And I open the document "notes/yard.md"
    Then the note line is about the note "notes/yard.md"
    And the line offers to chat about "yard"
    When I ask about this page "about the yard"
    Then the note "notes/yard.md" carries a chat as "yard-chat"
    And the chat page is about the note "notes/yard.md" named "yard"
    And the agent has answered "about the yard" exactly once
    And the note "notes/plan.md" carries a chat as "plan-chat"
    And there should be no page errors

  Scenario: The palette is the second door, and it closes once this note has a chat
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I press the palette shortcut
    Then the palette offers a chat about this page
    When I open chat about this page from the palette
    Then the palette placeholder is "Ask about plan…"
    And the palette footer mentions "Start chat"
    When I type "which hinges did we pick" into the palette
    And I press the palette submit
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the command palette is closed
    And the chat page is about the note "notes/plan.md" named "plan"
    And the agent has answered "which hinges did we pick" exactly once
    When I press the palette shortcut
    Then the palette offers no chat about this page
    And there should be no page errors

  Scenario: A chat tied from somewhere else closes every door on this note
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When another writer ties a chat to the note "notes/plan.md" as "theirs"
    Then the line offers no chat box
    And the line stands on the chat "theirs"
    When I press the palette shortcut
    Then the palette offers no chat about this page
    And no chat is filed under the Inbox
    And there should be no page errors

  Scenario: Closing a note's chat leaves its page offering a start, not a way back
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    When I close the chat from the chat page
    Then the chat page offers to chat about "plan"
    And the chat page never offers to tie it again
    And the note "notes/plan.md" has no chat
    And there should be no page errors

  Scenario: A quiet chat page offers the way back when the tie goes from outside
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    When I go back
    And I open the address "/chat/notes/plan.md"
    Then the chat page is about the note "notes/plan.md" named "plan"
    When the vault holds "notes/plan.md" saying "# Plan\n\nrewritten by its own agent"
    Then the chat page says "plan" no longer names this conversation
    And the chat page offers no chat box
    When I press tie it again
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And there should be no page errors

  Scenario: The agent is told which note the conversation belongs to
    Given the harness keeps distinct sessions on disk
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "read it and tell me"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the chat page conversation is ready
    And the chat page's first message names the note "notes/plan.md"
    And there should be no page errors

  Scenario: A refused start keeps the words in the line's box and sends once when it can
    Given the harness keeps distinct sessions on disk
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    And the agent refuses to new a conversation
    When I ask about this page "what is left to decide"
    Then the chat box in the line is refused with "this agent will not start a conversation in this directory"
    And the chat box in the line holds "what is left to decide"
    And there are 1 panes
    When I send the line box again
    Then the chat box in the line is refused with "this agent will not start a conversation in this directory"
    And the chat box in the line holds "what is left to decide"
    And the note "notes/plan.md" has no chat
    When the agent will new a conversation again
    And I send the line box again
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the chat page conversation is ready
    And the agent has answered "what is left to decide" exactly once
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
    And the chat page conversation is ready
    And the agent has answered "which hinges did we pick" exactly once
    And there should be no page errors

  @claude @signin
  Scenario: A start that stops at sign-in keeps the words for the conversation the sign-in opens
    Given the agent needs a sign-in
    And the vault holds "notes/plan.md" saying "# Plan"
    And I open the document "notes/plan.md"
    When I ask about this page "sign in first"
    Then the note "notes/plan.md" waits for a chat as "plan-chat"
    And the chat page is about the note "notes/plan.md" named "plan"
    And the panel offers a sign-in
    When I press the sign-in for "claude-ai-login"
    And I type "123456" into the sign-in
    Then the chat page conversation is ready
    And the chat input reads "sign in first"
    And the agent has said nothing yet
    When I send the chat message
    Then the agent has answered "sign in first" exactly once
    And the chat input reads ""
    And there should be no page errors

  Scenario: A note whose chat is asleep leaves it asleep until the line is pressed
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "theirs"
    And I open the document "notes/plan.md"
    Then the note line is about the note "notes/plan.md"
    And the line stands on the chat "theirs"
    And the line stands "asleep"
    And the agent "theirs" stands "asleep"
    When I click the document "finishes.md"
    Then the document open is "finishes.md"
    When I go back
    Then the document open is "notes/plan.md"
    And the agent "theirs" stands "asleep"
    When I open the chat from the line
    Then pane 1 is showing "/chat/notes/plan.md"
    And the chat page conversation is ready
    And the agent "theirs" stands "idle"
    And there should be no page errors

  Scenario: An agent cannot write the tie into a note
    Given the vault holds "notes/plan.md" saying "# Plan"
    And I open the app
    And a terminal agent is connected to the served directory
    When the terminal agent rewrites "notes/plan.md" expecting "# Plan\n", as "---\nchat-agent-session: claude:sneaky\n---\n# Plan\n"
    Then the terminal refusal says "notes/plan.md"
    And the terminal refusal says "`chat-agent-session` is a property this door may not write"
    And the terminal refusal says "it is what ties a conversation to a node or a note"
    And the terminal refusal says "in `notes/plan.md`'s front matter as anywhere else"
    And the note "notes/plan.md" has no chat
    And there should be no page errors

  Scenario: An agent cannot write the switch either
    Given the vault holds "notes/plan.md" saying "---\nchat-agent-session: claude:fake-session-1\nchat-opens: alone\n---\n# Plan\n"
    And I open the app
    And a terminal agent is connected to the served directory
    When the terminal agent rewrites "notes/plan.md" expecting "---\nchat-agent-session: claude:fake-session-1\nchat-opens: alone\n---\n# Plan\n", as "---\nchat-agent-session: claude:fake-session-1\nchat-opens: beside\n---\n# Plan\n"
    Then the terminal refusal says "chat-opens"
    And the terminal refusal says "the person's choice on the note"
    And the terminal refusal says "notes/plan.md"
    And the note "notes/plan.md" carries the tie "claude:fake-session-1" and opens alone
    And there should be no page errors

  Scenario: The tie and the switch are not drawn as properties of the note
    Given the vault holds "notes/plan.md" saying "---\ntopic: kitchen\nchat-agent-session: claude:fake-session-1\nchat-opens: beside\n---\n\n# Plan\n"
    And I open the document "notes/plan.md"
    Then the note line is about the note "notes/plan.md"
    And the document shows the property "topic" holding "kitchen"
    And the document shows no property "chat-agent-session"
    And the document shows no property "chat-opens"
    And there should be no page errors
