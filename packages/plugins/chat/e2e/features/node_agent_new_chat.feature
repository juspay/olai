@scratch:chat
Feature: A new chat asks where, then what to say, inside the palette
  New chat is a palette row whose first level asks where the chat belongs
  (Default, Here, Recent, and any node once something is typed) and whose
  second takes the first message and the engine. Nothing is created until the
  message is sent; the chat lands on its own page and answers once.

  Scenario Outline: Opening and backing out create nothing on <screen>
    Given I open the outline "house.olai"
    When the agent starts so far are counted
    And I press the palette shortcut
    And I open new chat from the palette
    Then the palette path is "new-chat"
    And the palette crumbs read "New chat"
    And the palette placeholder is "Where? Find a node…"
    And the palette hint says "Type to find any node"
    And the new chat places are "default"
    And the palette sections are "Default"
    When I choose the new chat place "default"
    Then the palette path is "new-chat, new-chat-default"
    And the palette placeholder is "Say something to start…"
    And the palette footer mentions "Start chat"
    When I press "Backspace"
    Then the palette path is "new-chat"
    When I press "Escape"
    Then the command palette is closed
    When I press new chat in Chats
    Then the palette path is "new-chat"
    And the new chat places are "default"
    When I choose the new chat place "default"
    And I press the palette crumb "new-chat"
    Then the palette path is "new-chat"
    When I press "Escape"
    Then the Inbox contains no chat children
    And no further agent process has started
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario Outline: Default sends once to a titled Inbox node page on <screen>
    Given I open the outline "house.olai"
    When I press new chat in Chats
    Then the new chat places are "default"
    When I press "Enter"
    And I type new chat draft "done hinges"
    And I press "Enter"
    Then the command palette is closed
    And the chat child under "chats" in "_olai/Inbox.olai" is titled "done hinges"
    And the agent is idle
    And the agent has answered "done hinges" exactly once
    And "house.olai" holds a node marked done titled "pick the hinges"
    And the new chat receives the ordinary node contract
    And the Inbox has 1 filed conversations
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario: A long first message names the node clipped at a word
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "Plan the kitchen renovation with enough detail to cover every cabinet and hinge"
    And I send the new chat draft
    Then the chat child under "chats" in "_olai/Inbox.olai" is titled "Plan the kitchen renovation with enough detail to cover…"
    And the agent has answered "Plan the kitchen renovation with enough detail to cover every cabinet and hinge" exactly once
    And there should be no page errors

  Scenario Outline: Here is the focused row or the zoomed node, and nothing otherwise, on <screen>
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I open new chat from the palette
    Then the new chat places are "default"
    When I press "Escape"
    And I zoom into the node "install"
    And I press new chat in Chats
    Then the new chat places are "default, install"
    And the palette sections are "Default, Here"
    And the palette row "new-chat-at-install" is placed "kitchen remodel #home"
    When I choose the new chat place "install"
    Then the palette crumbs read "New chat, install the cabinets"
    When I type new chat draft "hinges please"
    And I send the new chat draft
    Then the chat child under "install" in "house.olai" is titled "hinges please"
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
    Then the new chat places are "default, hinges"
    And there should be no page errors

  Scenario: Recent lists the parents of earlier chats, never the default container
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "into the inbox"
    And I send the new chat draft
    Then the chat child under "chats" in "_olai/Inbox.olai" is titled "into the inbox"
    And the agent has answered "into the inbox" exactly once
    When I click the outline "house.olai"
    And I press new chat in Chats
    Then the new chat places are "default"
    When I type "kitchen" into the palette
    And I choose the new chat place "kitchen"
    And I type new chat draft "under the kitchen"
    And I send the new chat draft
    Then the chat child under "kitchen" in "house.olai" is titled "under the kitchen"
    And the agent has answered "under the kitchen" exactly once
    When I click the outline "house.olai"
    And I press new chat in Chats
    Then the new chat places are "default, kitchen"
    And the palette sections are "Default, Recent"
    And the new chat places do not include "chats"
    And there should be no page errors

  Scenario: Typing finds any node and filters every section, never the vault's machinery
    Given I open the outline "house.olai"
    When I zoom into the node "install"
    And I press new chat in Chats
    And I type "supplier" into the palette
    Then the new chat places are "chase-supplier, chase-tiler"
    And the palette sections are "Nodes"
    When I type "settings" into the palette
    Then the new chat places name nothing in "_olai/Settings.olai"
    When I type "inbox" into the palette
    Then the new chat places include "default"
    And there should be no page errors

  @codex
  Scenario Outline: The engine is chosen by arrows or by a press on <screen>
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I choose the new chat place "default"
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
    Then the new Inbox conversation is unfolded as "new-chat" with engine "codex"
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
    And I choose the new chat place "default"
    Then the palette options are "claude"
    And the palette option "claude" is chosen
    And there should be no page errors

  Scenario: An empty message is refused in place and backing out creates nothing
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "   "
    And I send the new chat draft
    Then the palette refuses with "Type a message first."
    And the palette path is "new-chat, new-chat-default"
    When I type new chat draft ""
    And I press "Backspace"
    Then the palette path is "new-chat"
    When I press "Backspace"
    Then the palette path is ""
    And the Inbox contains no chat children
    And there should be no page errors

  Scenario: With capture off there is no Default, another parent still works, and Default returns with it
    Given I open the outline "house.olai"
    When I open the plugins panel
    And I switch the plugin "capture" off
    And I close the plugins panel
    And I press new chat in Chats
    Then the new chat places are ""
    When I type "kitchen" into the palette
    Then the new chat places do not include "default"
    When I choose the new chat place "kitchen"
    And I type new chat draft "another location"
    And I send the new chat draft
    Then the chat child under "kitchen" in "house.olai" is titled "another location"
    And the agent has answered "another location" exactly once
    When I open the plugins panel
    And I switch the plugin "capture" on
    And I close the plugins panel
    And I press new chat in Chats
    Then the new chat places include "default"
    And there should be no page errors

  Scenario: A parent that vanishes between choosing and sending refuses and keeps the words
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type "order the new" into the palette
    And I choose the new chat place "order"
    And I type new chat draft "keep after trash"
    And another writer removes the node "order" from "house.olai"
    And I send the new chat draft
    Then the palette refuses with "The chosen parent vanished, was trashed, or can no longer hold a chat; no conversation was created"
    And the new chat draft is "keep after trash"
    And the palette path is "new-chat, new-chat-at-order"
    And node "order" has no chat children
    And the Inbox contains no chat children
    And there should be no page errors

  @codex
  Scenario: A refused start lands the words and chosen engine on its titled plain node for retry
    Given I open the outline "house.olai"
    When the agent refuses to new a conversation
    And I press new chat in Chats
    And I choose the new chat place "default"
    And I choose new chat engine "Codex"
    And I type new chat draft "retry on its own node"
    And I send the new chat draft
    Then the command palette is closed
    And the refused new chat leaves a plain Inbox node as "new-chat"
    And the plain retry draft is "retry on its own node"
    And the plain retry engine is "codex"
    When the agent will new a conversation again
    And I retry the plain chat draft
    Then the node page conversation is ready for "new-chat"
    And the agent has answered "retry on its own node" exactly once
    And the Inbox has 1 filed conversations
    And there should be no page errors

  Scenario: A held creation refuses a second one, from a level opened again
    Given I open the outline "house.olai"
    When the next agent boot will hang
    And I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "only once"
    And I send the new chat draft
    Then the palette level is busy
    And new chat in Chats is starting
    When I send the new chat draft
    Then the palette level is busy
    When I press "Escape"
    And I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "a second one"
    And I send the new chat draft
    Then the palette refuses with "A new chat is already starting"
    And the new chat draft is "a second one"
    When I press "Escape"
    And the agent is released
    Then new chat in Chats is not starting
    And the Inbox holds a chat titled "only once" as "first"
    And the Inbox has 1 filed conversations
    And there should be no page errors

  Scenario: Closing the palette mid-creation does not navigate and keeps the words as the chat's draft
    Given I open the outline "house.olai"
    When the next agent boot will hang
    And I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "keep this first message"
    And I send the new chat draft
    Then new chat in Chats is starting
    When I press "Escape"
    And the agent is released
    Then the Inbox holds a chat titled "keep this first message" as "kept"
    And new chat in Chats is not starting
    And no page shows node "kept"
    When I press the agent "kept"
    Then the node page conversation is ready for "kept"
    And the chat input reads "keep this first message"
    And there should be no page errors

  Scenario: Closing the palette before a refused start keeps the words on the plain node
    Given I open the outline "house.olai"
    When the next agent boot will hang
    And I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "keep after leaving"
    And I send the new chat draft
    Then new chat in Chats is starting
    When I press "Escape"
    And the agent refuses to new a conversation
    And the agent is released
    Then the Inbox holds a chat titled "keep after leaving" as "plain"
    And new chat in Chats is not starting
    And no page shows node "plain"
    When I go to node "plain" from the palette
    Then the plain retry draft is "keep after leaving"
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
    And the Inbox contains no chat children
    And there should be no page errors

  Scenario: Chat switched off while its level is open falls back without errors
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "never sent"
    And the non-UI controller sets plugin "chat" off
    Then the palette path is ""
    And the palette remarks "“New chat” is no longer available."
    When the non-UI controller sets plugin "chat" on
    Then the palette path is ""
    And the Inbox contains no chat children
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
    And I choose the new chat place "default"
    And I type new chat draft "independent new conversation"
    And I send the new chat draft
    Then the new Inbox conversation is unfolded as "new-chat" with engine "claude"
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
    And the Inbox contains no chat children
    And there should be no page errors
