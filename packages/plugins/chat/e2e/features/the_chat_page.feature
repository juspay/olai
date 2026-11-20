@scratch:chat
Feature: A chat is a page of its own
  A conversation belongs to one item — a node or a note — and it has one
  address: `/chat/<the item>`. Every door that opens a chat goes there, the
  pane is headed by the item's NAME rather than by a path or a uuid, and the
  page itself says what the chat is about without a breadcrumb: the item's
  mark and name, where it is, how it stands, and the conversation under them.

  From that page the item comes back beside its chat — *Open plan beside ›*
  puts the note in the pane on the left and moves the conversation to the one
  on its right — and for a note the page carries the switch that says where
  that chat opens, written in the note's own front matter.

  Scenario: Pressing a Chats row opens the note's chat as a page, named by the note
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then pane 0 is showing "/chat/notes/plan.md"
    And the chat page is about the note "notes/plan.md" named "plan"
    And the chat page shows no breadcrumb
    And the Chats row "plan-chat" is current
    And the chat page conversation is ready
    And the chat page never offers sleep or tidying
    When I ask the agent "and the hinges"
    Then the agent has answered "and the hinges" exactly once
    And there should be no page errors

  Scenario: A node's chat is a page named by its row, with its sleep line on it
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I press the Chats row "install"
    Then pane 0 is showing "/chat/install"
    And the chat page is about the node "install" named "install the cabinets" in "house.olai"
    And the chat page shows no breadcrumb
    And the chat page conversation is ready
    And the chat page offers to put the chat to sleep
    And the chat page has no opens switch
    And there should be no page errors

  Scenario: Open beside puts the note on the left, names both panes, and then only focuses it
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page offers to open "plan" beside
    When I press Open beside on the chat page
    Then there are 2 panes
    And pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
    And pane 1 is focused
    And pane 0's header reads "plan", and its close button is called "Close plan"
    And pane 1's header reads "plan · chat", and its close button is called "Close plan · chat"
    And the chat page conversation is ready
    And the chat page says the item is shown beside
    When I press Open beside on the chat page
    Then there are 2 panes
    And pane 0 is focused
    And there should be no page errors

  Scenario: Open beside is one step of history, so Back returns to the chat alone
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then there are 1 panes
    And pane 0 is showing "/chat/notes/plan.md"
    When I press Open beside on the chat page
    Then there are 2 panes
    And pane 1 is showing "/chat/notes/plan.md"
    When I go back
    Then there are 1 panes
    And pane 0 is showing "/chat/notes/plan.md"
    And the chat page conversation is ready
    And there should be no page errors

  Scenario: A chat page whose note is renamed on disk says the note is gone
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    When I ask the agent "and the hinges"
    And the file "notes/plan.md" is renamed to "notes/kitchen-plan.md"
    Then the chat page says the note is gone
    And the chat page offers no chat box
    When I open the address "/chat/notes/kitchen-plan.md"
    Then the chat page is about the note "notes/kitchen-plan.md" named "kitchen-plan"
    And the chat page conversation is ready
    And there should be no page errors

  Scenario: A note rewritten without its front matter is tied again in one press
    Given the vault holds "plugins/swatch/README.md" saying "# Swatch"
    And another writer ties a chat to the note "plugins/swatch/README.md" as "swatch-chat"
    And I open the outline "house.olai"
    When I press the Chats row "swatch-chat"
    Then the chat page is about the note "plugins/swatch/README.md" named "swatch"
    And the chat page conversation is ready
    When the vault holds "plugins/swatch/README.md" saying "# Swatch\n\nrewritten by its own agent"
    Then the chat page says "swatch" no longer names this conversation
    And the chat page offers no chat box
    When I press tie it again
    Then the note "plugins/swatch/README.md" carries a chat as "swatch-chat"
    And the chat page conversation is ready
    And there should be no page errors

  Scenario: The switch says where a note's chat opens, both ways, and the note keeps the answer
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page says it opens "alone"
    When I press the opens switch
    Then the note "notes/plan.md" says it opens "beside"
    And the chat page says it opens "with plan beside"
    When I reload the page
    Then the chat page says it opens "with plan beside"
    When I press the opens switch
    Then the note "notes/plan.md" says it opens "alone"
    And the chat page says it opens "alone"
    And there should be no page errors

  Scenario: A chat page for a note with no chat offers one, and sending ties it
    Given the vault holds "notes/plan.md" saying "# Plan"
    When I open the address "/chat/notes/plan.md"
    Then the chat page is about the note "notes/plan.md" named "plan"
    And the chat page offers to chat about "plan"
    When I ask from the chat page "what is left to decide"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the chat page offers no chat box
    And the chat page conversation is ready
    And the agent has answered "what is left to decide" exactly once
    And there should be no page errors

  Scenario: The palette's agent row opens the chat page
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the outline "yard.olai"
    And I press the palette shortcut
    And I pick the Agents palette row "install"
    Then pane 0 is showing "/chat/install"
    And the chat page is about the node "install" named "install the cabinets" in "house.olai"
    And there should be no page errors

  Scenario: A row titled as a link with no chat is called by its label
    Given the vault holds "notes/plan.md" saying "# Plan"
    And the vault holds the row "link-row" titled "[plan](/notes/plan.md)" with no chat
    When I open the address "/chat/link-row"
    Then the chat page is about the node "link-row" named "plan" in "link-row.olai"
    And the chat page offers to chat about "plan"
    When I press Open beside on the chat page
    Then there are 2 panes
    And pane 1's header reads "plan · chat", and its close button is called "Close plan · chat"
    And there should be no page errors
