@scratch:chat
Feature: A new chat asks where it belongs before creating anything
  Scenario Outline: Opening and leaving are read-only on <screen>
    Given I open the outline "house.olai"
    When the agent starts so far are counted
    And I press new chat in Chats
    Then the new chat composer is focused
    And the Inbox contains no chat children
    And no further agent process has started
    When I type new chat draft "keep these words"
    And I open the new chat location picker
    And I choose new chat under node "kitchen"
    And I click the outline "house.olai"
    And I press new chat in Chats
    Then the new chat draft is "keep these words"
    And the new chat location contains "kitchen"
    And the Inbox contains no chat children
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
    Then the new chat location contains "In: Inbox › Chats"
    When I type new chat draft "done hinges"
    And I press "Enter"
    Then the chat child under "chats" in "_olai/Inbox.olai" is titled "done hinges"
    And the agent is idle
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

  Scenario: Multiline prose gives the node a clipped first nonempty line
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type new chat draft "\nPlan the kitchen renovation with enough detail to cover every cabinet and hinge\nSecond line stays in the message"
    And I send the new chat draft
    Then the chat child under "chats" in "_olai/Inbox.olai" is titled "Plan the kitchen renovation with enough detail to cover…"
    And the agent's answer mentions "Second line stays in the message"
    And there should be no page errors

  Scenario: Here and Suggested use the origin and draft; choosing another parent is visible
    Given I open the outline "house.olai"
    When I zoom into the node "install"
    And I press new chat in Chats
    And I type new chat draft "hinges"
    And I open the new chat location picker
    Then the chat location picker has section "Default"
    And the chat location picker has section "Here"
    And the chat location picker has section "Suggested"
    When I choose new chat under node "kitchen"
    Then the new chat composer is focused
    And the new chat location contains "In: house.olai"
    When I send the new chat draft
    Then the chat child under "kitchen" in "house.olai" is titled "hinges"
    And the agent has answered "hinges" exactly once
    When I press new chat in Chats
    And I open the new chat location picker
    Then the chat location picker has section "Recent"
    And there should be no page errors

  @rows-off:search
  Scenario: Search is optional and no origin invents no Here
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type new chat draft "hinges"
    And I open the new chat location picker
    Then the chat location picker omits section "Suggested"
    And the chat location picker omits section "Here"
    When I filter chat locations by "kitchen"
    And I choose new chat under node "kitchen"
    And I send the new chat draft
    Then the chat child under "kitchen" in "house.olai" is titled "hinges"
    And the agent has answered "hinges" exactly once
    And there should be no page errors

  Scenario: On this node preserves its title and creates no child
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type new chat draft "hello here"
    And I open the new chat location picker
    And I choose new chat on node "install"
    Then the new chat location contains "On: house.olai"
    When I send the new chat draft
    Then the node page conversation is ready for "install"
    And the agent has answered "hello here" exactly once
    And node "install" keeps title "install the cabinets" and has no new chat child
    When I press new chat in Chats
    And I open the new chat location picker
    Then chat on node "install" itself is not offered
    And there should be no page errors

  @codex
  Scenario: The palette and plus share the page and engine selection
    Given I open the outline "house.olai"
    When I press "Enter" on new chat in Chats
    Then the new chat composer is focused
    And the new chat offers engines "Claude Code|Codex"
    When I type new chat draft "chosen in the palette"
    And I click the outline "house.olai"
    And I press the palette shortcut
    And I type "Agents" into the palette
    And I pick new chat in the Agents palette
    Then the new chat draft is "chosen in the palette"
    When I choose new chat engine "Codex"
    And I send the new chat draft
    Then the new Inbox conversation is unfolded as "new-chat" with engine "codex"
    And the agent has answered "chosen in the palette" exactly once
    And there should be no page errors

  Scenario: Capture returning permits default retry without losing words
    Given I open the outline "house.olai"
    When I open the plugins panel
    And I switch the plugin "capture" off
    And I press "Escape"
    And I press new chat in Chats
    And I type new chat draft "retry default"
    And I send the new chat draft
    Then new chat says "the Inbox is unavailable; no conversation was created"
    And the new chat draft is "retry default"
    And the Inbox contains no chat children
    When I open the plugins panel
    And I switch the plugin "capture" on
    And I press "Escape"
    And I send the new chat draft
    Then the new Inbox conversation is unfolded as "new-chat" with engine "claude"
    And the agent has answered "retry default" exactly once
    And there should be no page errors

  @rows-off:capture
  Scenario: Capture absence does not prevent another parent
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type new chat draft "another location"
    And I send the new chat draft
    Then new chat says "the Inbox is unavailable; no conversation was created"
    When I open the new chat location picker
    And I choose new chat under node "kitchen"
    And I send the new chat draft
    Then the chat child under "kitchen" in "house.olai" is titled "another location"
    And the agent has answered "another location" exactly once
    And there should be no page errors

  Scenario: A held creation cannot be spent twice across the two doors
    Given I open the outline "house.olai"
    When the next agent boot will hang
    And I press new chat in Chats
    And I type new chat draft "only once"
    And I send the new chat draft
    Then new chat in Chats is starting
    When I type new chat draft "later words"
    And I press the palette shortcut
    And I type "Agents" into the palette
    And I pick new chat in the Agents palette
    And I send the new chat draft
    Then new chat says "A new chat is already starting"
    When the agent is released
    Then the new Inbox conversation is unfolded as "new-chat" with engine "claude"
    And the agent has answered "only once" exactly once
    And the chat input reads "later words"
    And the Inbox has 1 filed conversations
    And there should be no page errors

  @no-agent
  Scenario: With no engine the page explains absence and the palette omits the door
    Given I open the outline "house.olai"
    When I press new chat in Chats
    Then new chat shows the no-agent face
    When I press the palette shortcut
    And I type "Agents" into the palette
    Then the palette does not offer "New chat"
    And the Inbox contains no chat children
    And there should be no page errors

  @codex
  Scenario: A refused start lands the words and chosen engine on its titled plain node for retry
    Given I open the outline "house.olai"
    When the agent refuses to new a conversation
    And I press new chat in Chats
    And I choose new chat engine "Codex"
    And I type new chat draft "retry on its own node"
    And I send the new chat draft
    Then the refused new chat leaves a plain Inbox node as "new-chat"
    And the plain retry draft is "retry on its own node"
    And the plain retry engine is "codex"
    When the agent will new a conversation again
    And I retry the plain chat draft
    Then the node page conversation is ready for "new-chat"
    And the agent has answered "retry on its own node" exactly once
    And the Inbox has 1 filed conversations
    And there should be no page errors
  @new-chat-review
  Scenario: New chat leaves another node's pending question and draft intact
    Given the harness keeps distinct sessions on disk
    And I click the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I remember this conversation as "waiting"
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I type "kept while another node starts" into the question's "note" box
    And I press new chat in Chats
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

  Scenario: A parent put away after picking refuses without losing words or location
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I type new chat draft "keep after trash"
    And I open the new chat location picker
    And I choose new chat under node "kitchen"
    And I click the outline "house.olai"
    And I open the node menu of "kitchen"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "house.olai" no longer holds the node "kitchen"
    When I press new chat in Chats
    And I send the new chat draft
    Then new chat says "The chosen parent vanished, was trashed, or can no longer hold a chat"
    And the new chat draft is "keep after trash"
    And the new chat location contains "kitchen"
    And the Inbox contains no chat children
    And there should be no page errors

  Scenario: Alt Enter selects the plain node itself
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I open the new chat location picker
    And I filter chat locations by "pick the hinges"
    And I press "Alt+Enter"
    Then the new chat location contains "On: house.olai"
    And the new chat composer is focused
    When I type new chat draft "on hinges"
    And I send the new chat draft
    Then the node page conversation is ready for "hinges"
    And the agent has answered "on hinges" exactly once
    And there should be no page errors

  Scenario: Rebuilding chat releases the old draft and pending callback
    Given I open the outline "house.olai"
    When the next agent boot will hang
    And I press new chat in Chats
    And I type new chat draft "old activation"
    And I send the new chat draft
    Then new chat in Chats is starting
    When I open the plugins panel
    And I switch the plugin "chat" off
    And I switch the plugin "chat" on
    And I close the plugins panel
    And the agent is released
    And I press new chat in Chats
    Then the new chat draft is ""
    And the new chat location contains "In: Inbox › Chats"
    And there should be no page errors
