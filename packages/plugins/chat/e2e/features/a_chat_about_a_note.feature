@scratch:chat
Feature: A chat about a note
  A conversation can be ABOUT a note — a `.md` file — and the tie lives in that
  note's own front matter: `chat-agent-session`, beside the prose, where a
  person can read it and a `git pull` carries it. Nothing is filed anywhere
  else. The note's page says so in one line at the top: how its chat stands and
  the way into it, in the pane beside the page. Where there is no chat yet that
  line offers one — a box, the side panel's **This page** block, and a palette
  row. All three start the same thing, with the first message delivered once,
  all three open the conversation beside the note, and all three go away the
  moment that note has a chat.

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
    # WHAT IT STARTED OPENS BESIDE THE NOTE — once, on this press: the page
    # never opens a pane by itself.
    And the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    # ONCE: the server delivers the door's first message, and a second delivery
    # would draw a second answer under the same words.
    And the agent has answered "when do the cabinets land" exactly once
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  # ...AND THE NOTE'S OWN LINE SAYS WHERE THE CONVERSATION WENT, which is the
  # drawn-once rule read from the other side.
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

  # ONE NOTE, ONE CHAT, and a second note has its own: the tie is a property of
  # the FILE, so two notes never share a conversation.
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
    # The note's own line now stands on that chat, and offers no box.
    And the line stands on the chat "plan-chat"
    And the line offers no chat box
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
    # ...and the palette's door opens the conversation beside the note too.
    And the chat page is about the note "notes/plan.md" named "plan"
    And the agent has answered "which hinges did we pick" exactly once
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
    Then the line offers no chat box
    # ... and the page did not open it: a chat it did not start is one line
    # saying how it stands until somebody presses it.
    And the line stands on the chat "theirs"
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
    And the chat page conversation is ready
    And the chat page's first message names the note "notes/plan.md"
    And there should be no page errors

  # A REFUSED START KEEPS THE WORDS. The agent will not start, so there is no
  # conversation to put them in — and a box that cleared itself would have
  # thrown away the only copy. NOTHING IS WRITTEN INTO THE NOTE either: a
  # refusal ties nothing, so the person's file is left exactly as it was and
  # the door is still the door. Retrying from that same box ties the one chat.
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
    # The chat page opened beside the note, and the sign-in is on it.
    And the chat page is about the note "notes/plan.md" named "plan"
    And the panel offers a sign-in
    When I press the sign-in for "claude-ai-login"
    And I type "123456" into the sign-in
    Then the chat page conversation is ready
    And the chat input reads "sign in first"
    # NOT SENT BY THEMSELVES: nothing was answered until the person pressed.
    And the agent has said nothing yet
    When I send the chat message
    Then the agent has answered "sign in first" exactly once
    And the chat input reads ""
    And there should be no page errors

  # OPENING A NOTE WAKES NOTHING. The line is drawn from the roster: it says
  # how the chat there stands and reads nothing at all, so the agent is still
  # asleep after the page has been opened and left.
  Scenario: A note whose chat is asleep leaves it asleep until the line is pressed
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "theirs"
    And I open the document "notes/plan.md"
    Then the note line is about the note "notes/plan.md"
    And the line stands on the chat "theirs"
    And the line stands "asleep"
    And the agent "theirs" stands "asleep"
    # AWAY AND BACK, with nothing woken in between.
    When I click the document "finishes.md"
    Then the document open is "finishes.md"
    When I go back
    Then the document open is "notes/plan.md"
    And the agent "theirs" stands "asleep"
    # ...and the press is what opens it, in the pane beside the note.
    When I open the chat from the line
    Then pane 1 is showing "/chat/notes/plan.md"
    And the chat page conversation is ready
    And the agent "theirs" stands "idle"
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
