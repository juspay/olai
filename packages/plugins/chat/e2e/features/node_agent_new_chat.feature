@scratch:chat
Feature: A new chat asks which node or note, then what to say, inside the palette
  New chat is a palette row whose first level asks which node or note the chat
  is for (Here, Recent, and any node or note once something is typed) and whose
  second takes the first message and the engine. Nothing is minted anywhere: a
  chat belongs to a thing that already exists, so a send writes the tie on that
  row or in that note's front matter and opens its chat page. An item that
  already has a chat says so, and choosing it opens that conversation instead
  of starting a second.

  Scenario Outline: Opening and backing out create nothing on <screen>
    Given I open the outline "house.olai"
    When the stored chats have been listed
    And the agent starts so far are counted
    And I press the palette shortcut
    And I open new chat from the palette
    Then the palette path is "new-chat"
    And the palette crumbs read "New chat"
    And the palette placeholder is "Which node or note? Find one…"
    And the palette hint says "Type to find any node or note"
    # NOTHING IS OFFERED UNTIL A PERSON SAYS WHAT THE CHAT IS FOR: standing on
    # an outline's root there is no Here, nothing has been typed, and no chat
    # has been had here before — so the level is empty rather than offering
    # something olai picked.
    And the new chat items are ""
    When I type "pick the hinges" into the palette
    Then the new chat items are "hinges"
    And the palette sections are "Nodes"
    When I choose the new chat item "hinges"
    Then the palette path is "new-chat, new-chat-at-hinges"
    And the palette placeholder is "Say something to start…"
    And the palette footer mentions "Start chat"
    When I press "Backspace"
    Then the palette path is "new-chat"
    When I press "Escape"
    Then the command palette is closed
    When I press new chat in Chats
    Then the palette path is "new-chat"
    And the new chat items are ""
    When I type "pick the hinges" into the palette
    And I choose the new chat item "hinges"
    And I press the palette crumb "new-chat-at-hinges"
    Then the palette path is "new-chat"
    When I press the palette crumb "new-chat"
    Then the palette path is ""
    When I press "Escape"
    Then nothing in the vault has a chat
    And no further agent process has started
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario Outline: A chosen node takes the chat itself and the message is sent once on <screen>
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type "pick the hinges" into the palette
    Then the new chat items are "hinges"
    # PLAIN ENTER TAKES THE FIRST ROW, which is the row a person is looking at.
    When I press "Enter"
    And I type new chat draft "done hinges"
    And I press "Enter"
    Then the command palette is closed
    And the new conversation is unfolded as "hinges" with engine "claude"
    And the chat page conversation is ready
    # THE CHAT IS THE ROW'S OWN: nothing was written under it.
    And the node "hinges" has no children
    # ONCE: the server delivers the first message, and a second delivery would
    # draw a second identical row. The words are the harness agent's own verb,
    # so what it did with them is the other half of "sent once".
    And the chat shows my message "done hinges" exactly once
    And the agent is idle
    And "house.olai" holds a node marked done titled "pick the hinges"
    And the new chat receives the ordinary node contract
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario: A chosen note takes the chat in its own front matter
    Given the vault holds "notes/plan.md" saying "The kitchen plan."
    And I open the outline "house.olai"
    When I press new chat in Chats
    And I type "plan" into the palette
    Then the new chat items include "notes/plan.md"
    And the palette sections are "Notes"
    When I choose the new chat item "notes/plan.md"
    And I type new chat draft "what is in this note"
    And I send the new chat draft
    Then the command palette is closed
    And the item "notes/plan.md" carries a chat on "claude"
    And the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    And the agent has answered "what is in this note" exactly once
    And there should be no page errors

  Scenario: An item that already has a chat says so, and choosing it opens that chat
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type "pick the hinges" into the palette
    And I choose the new chat item "hinges"
    And I type new chat draft "first words"
    And I send the new chat draft
    Then the new conversation is unfolded as "hinges" with engine "claude"
    And the agent has answered "first words" exactly once
    When I press new chat in Chats
    And I type "pick the hinges" into the palette
    Then the new chat item "hinges" says it has a chat
    # NO SECOND CHAT AND NO MESSAGE ASKED FOR: the press opens the conversation
    # that is already there.
    When I choose the new chat item "hinges"
    Then the command palette is closed
    And the chat page is about the node "hinges" named "pick the hinges" in "house.olai"
    And the chat page conversation is ready
    And there should be no page errors

  Scenario Outline: Here is the focused row or the zoomed node, and nothing otherwise, on <screen>
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I open new chat from the palette
    Then the new chat items are ""
    When I press "Escape"
    And I zoom into the node "install"
    And I press new chat in Chats
    Then the new chat items are "install"
    And the palette sections are "Here"
    And the palette row "new-chat-at-install" is placed "kitchen remodel #home"
    When I choose the new chat item "install"
    Then the palette crumbs read "New chat, install the cabinets"
    When I type new chat draft "hinges please"
    And I send the new chat draft
    Then the new conversation is unfolded as "install" with engine "claude"
    And the agent has answered "hinges please" exactly once
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario: A focused row is Here
    Given I open the outline "house.olai"
    When I point at row "hinges" in outline "house.olai"
    And I press the palette shortcut
    And I open new chat from the palette
    Then the new chat items are "hinges"
    And there should be no page errors

  Scenario: Here is the note the focused pane is reading
    Given the vault holds "notes/plan.md" saying "The kitchen plan."
    And I open the document "notes/plan.md"
    When I press new chat in Chats
    Then the new chat items are "notes/plan.md"
    And the palette sections are "Here"
    And there should be no page errors

  Scenario: Recent lists the items of earlier chats
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type "pick the hinges" into the palette
    And I choose the new chat item "hinges"
    And I type new chat draft "under the hinges"
    And I send the new chat draft
    Then the new conversation is unfolded as "hinges" with engine "claude"
    And the agent has answered "under the hinges" exactly once
    When I click the outline "house.olai"
    And I press new chat in Chats
    Then the new chat items are "hinges"
    And the palette sections are "Recent"
    And the new chat item "hinges" says it has a chat
    And there should be no page errors

  Scenario: Typing finds any node and any note, and never the vault's machinery
    Given the vault holds "notes/plan.md" saying "The kitchen plan."
    And I open the outline "house.olai"
    When I zoom into the node "install"
    And I press new chat in Chats
    And I type "supplier" into the palette
    Then the new chat items are "chase-supplier, chase-tiler"
    And the palette sections are "Nodes"
    When I type "settings" into the palette
    Then the new chat items name nothing in "_olai/Settings.olai"
    # ...NOR WHAT IS IN THE BIN: a trashed node is machinery too, and a chat
    # about one would be a conversation nobody ever finds again.
    When I type "tiles" into the palette
    Then the new chat items are ""
    When I type "plan" into the palette
    Then the new chat items include "notes/plan.md"
    And there should be no page errors

  Scenario: A plugin's README is offered under its folder's name
    Given the vault holds "plugins/swatch/README.md" saying "A plugin called Swatch."
    And I open the outline "house.olai"
    When I press new chat in Chats
    And I type "swatch" into the palette
    Then the new chat items include "plugins/swatch/README.md"
    And the new chat item "plugins/swatch/README.md" is named "swatch"
    And there should be no page errors

  @codex
  Scenario Outline: The engine is chosen by arrows or by a press on <screen>
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type "pick the hinges" into the palette
    And I choose the new chat item "hinges"
    Then the palette options are "claude, codex"
    And the palette option "claude" is chosen
    When I press "ArrowDown"
    Then the palette option "codex" is chosen
    When I press "ArrowDown"
    Then the palette option "claude" is chosen
    When I press the palette option "codex"
    Then the palette option "codex" is chosen
    When I type new chat draft "chosen in the palette"
    And I press the palette submit
    Then the new conversation is unfolded as "hinges" with engine "codex"
    And the agent has answered "chosen in the palette" exactly once
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario: A single engine is still shown as the one option
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type "pick the hinges" into the palette
    And I choose the new chat item "hinges"
    Then the palette options are "claude"
    And the palette option "claude" is chosen
    And there should be no page errors

  Scenario: An empty message is refused in place and backing out creates nothing
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type "pick the hinges" into the palette
    And I choose the new chat item "hinges"
    And I type new chat draft "   "
    And I send the new chat draft
    Then the palette refuses with "Type a message first."
    And the palette path is "new-chat, new-chat-at-hinges"
    When I type new chat draft ""
    And I press "Backspace"
    Then the palette path is "new-chat"
    When I press "Backspace"
    Then the palette path is ""
    And nothing in the vault has a chat
    And there should be no page errors

  Scenario: An item that vanishes between choosing and sending refuses and keeps the words
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type "order the new" into the palette
    And I choose the new chat item "order"
    And I type new chat draft "keep after trash"
    And another writer removes the node "order" from "house.olai"
    And I send the new chat draft
    Then the palette says "to talk about; no conversation was created"
    And the new chat draft is "keep after trash"
    And the palette path is "new-chat, new-chat-at-order"
    And nothing in the vault has a chat
    And there should be no page errors

  @codex
  Scenario: A refused start keeps the words and leaves the item ready to try again
    Given I open the outline "house.olai"
    When the agent refuses to new a conversation
    And I press new chat in Chats
    And I type "pick the hinges" into the palette
    And I choose the new chat item "hinges"
    And I choose new chat engine "Codex"
    And I type new chat draft "retry on its own item"
    And I send the new chat draft
    # THE WORDS STAY WHERE THEY WERE TYPED, with the sentence beside them, so
    # one more Send starts THAT item rather than a second chat anywhere.
    Then the new chat draft is "retry on its own item"
    And the palette path is "new-chat, new-chat-at-hinges"
    When the agent will new a conversation again
    And I send the new chat draft
    Then the command palette is closed
    And the new conversation is unfolded as "hinges" with engine "codex"
    And the chat page conversation is ready
    And the agent has answered "retry on its own item" exactly once
    And there should be no page errors

  Scenario: A held creation refuses a second one, from a level opened again
    Given I open the outline "house.olai"
    When the next agent boot will hang
    And I press new chat in Chats
    And I type "pick the hinges" into the palette
    And I choose the new chat item "hinges"
    And I type new chat draft "only once"
    And I send the new chat draft
    Then the palette level is busy
    And new chat in Chats is starting
    When I send the new chat draft
    Then the palette level is busy
    When I press the palette scrim
    Then the command palette is closed
    When I press new chat in Chats
    And I type "order the new" into the palette
    And I choose the new chat item "order"
    Then the palette level is not busy
    When I type new chat draft "a second one"
    And I send the new chat draft
    Then the palette says "A new chat is already starting"
    And the new chat draft is "a second one"
    When I press the palette scrim
    And the agent is released
    Then new chat in Chats is not starting
    And the item "hinges" carries a chat on "claude"
    And there should be no page errors

  Scenario: Closing the palette mid-creation still starts the chat on the item
    Given I open the outline "house.olai"
    When the next agent boot will hang
    And I press new chat in Chats
    And I type "pick the hinges" into the palette
    And I choose the new chat item "hinges"
    And I type new chat draft "keep this first message"
    And I send the new chat draft
    Then new chat in Chats is starting
    When I press the palette scrim
    And the agent is released
    Then new chat in Chats is not starting
    # THE SERVER DELIVERS THE FIRST MESSAGE, so leaving the palette does not
    # lose the words — and nothing navigated, because nobody is looking.
    And the item "hinges" carries a chat on "claude"
    And the agent has answered "keep this first message" exactly once
    And there should be no page errors

  @no-agent
  Scenario: With no engine there is no New chat row and the + says so
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "new chat" into the palette
    Then the palette does not offer "New chat"
    When I press "Escape"
    And I press new chat in Chats
    Then the agent menu says no agent is set up
    And nothing in the vault has a chat
    And there should be no page errors

  Scenario: Chat switched off while its level is open falls back without errors
    Given the vault defines a non-UI host management controller
    And I open the outline "house.olai"
    And I open the plugins panel
    And I approve the plugin "management-controller"
    And I close the plugins panel
    When I press new chat in Chats
    And I type "pick the hinges" into the palette
    And I choose the new chat item "hinges"
    And I type new chat draft "never sent"
    And the non-UI controller sets plugin "chat" off
    Then the palette path is ""
    And the palette remarks "“New chat” is no longer available."
    When the non-UI controller sets plugin "chat" on
    Then the palette path is ""
    And nothing in the vault has a chat
    And there should be no page errors

  # THE LEVEL'S QUESTION ACROSS A RECOMPOSE. A plugin switched on or off makes
  # this tab dial a new wire, and a question asked across that moment is
  # interrupted rather than answered. The level stands down while the tab is
  # composing and asks again when it has settled — the event itself, not a
  # clock — so a plugin arriving leaves the list where it was, and a question
  # typed in the same breath is still answered.
  Scenario: A plugin switched while the level is open leaves it answering
    Given the vault defines a non-UI host management controller
    And I open the outline "house.olai"
    And I open the plugins panel
    And I approve the plugin "management-controller"
    And I close the plugins panel
    When I press new chat in Chats
    And I type "pick the hinges" into the palette
    Then the new chat items are "hinges"
    When the non-UI controller sets plugin "journal" off
    Then the new chat items are "hinges"
    When I type "order the new" into the palette
    Then the new chat items are "order"
    When the non-UI controller sets plugin "journal" on
    And I type "pick the hinges" into the palette
    Then the new chat items are "hinges"
    And there should be no page errors

  @new-chat-review
  Scenario: New chat leaves another node's pending question and draft intact
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I remember this conversation as "waiting"
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I type "kept while another node starts" into the question's "note" box
    And I press new chat in Chats
    And I type "order the new" into the palette
    And I choose the new chat item "order"
    And I type new chat draft "independent new conversation"
    And I send the new chat draft
    Then the new conversation is unfolded as "order" with engine "claude"
    And the panel has a different conversation from "waiting"
    And the agent "install" stands "needs-you"
    Then the agent has answered "independent new conversation" exactly once
    When I press the agent "install"
    Then the question's "note" box still reads "kept while another node starts"
    When I type "2" into the question's "howMany" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "kept while another node starts"
    And there should be no page errors

  Scenario: A > typed at the root is no longer a command
    Given I open the outline "house.olai"
    When I point at row "hinges" in outline "house.olai"
    And I press the palette shortcut
    And I type "> keep these words" into the palette
    Then the palette does not offer "Ask the agent"
    When I press "Enter"
    Then no agent fold is open
    And nothing in the vault has a chat
    And there should be no page errors
