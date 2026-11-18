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
    # A NOTE IS THE MEMORY OF ITS CHAT: nothing here offers to tidy it or to
    # put it to sleep on a clock.
    And the chat page never offers sleep or tidying
    When I ask the agent "and the hinges"
    Then the agent has answered "and the hinges" exactly once
    And there should be no page errors

  # A NODE'S CHAT IS THE SAME PAGE, named by the row's live title and showing
  # the outline it is written in — and its sleep line, which is the one thing
  # a note's chat has not got.
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
    # THE PANES ARE HEADED BY THE NAME: a column headed `/notes/plan.md` or a
    # row id is a column nobody can tell from the one beside it — and the
    # chat's column says it is the chat, or these two would read the same word.
    And pane 0's header reads "plan", and its close button is called "Close plan"
    And pane 1's header reads "plan · chat", and its close button is called "Close plan · chat"
    # ...and the conversation came with it: the chat moved, it did not reopen.
    And the chat page conversation is ready
    # ONCE THE ITEM IS BESIDE IT the button says so and opens nothing: a second
    # press would quietly grow a third pane.
    And the chat page says the item is shown beside
    When I press Open beside on the chat page
    Then there are 2 panes
    And pane 0 is focused
    And there should be no page errors

  # ONE PRESS, ONE ENTRY. *Open beside* is two acts — this pane becomes the
  # note, the chat opens to its right — and a Back that undid only half of it
  # left the reader somewhere they had never been.
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

  # A NOTE CAN GO WHILE ITS CHAT IS OPEN — renamed in a terminal, pulled away
  # by a `git pull`. The page says so and offers no start: a door onto a file
  # that is not there is a chat nothing could be written to.
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
    # ...AND THE CHAT WENT WITH THE FILE: the tie is front matter, so the
    # conversation is at the new note's own address.
    When I open the address "/chat/notes/kitchen-plan.md"
    Then the chat page is about the note "notes/kitchen-plan.md" named "kitchen-plan"
    And the chat page conversation is ready
    And there should be no page errors

  # ...AND A NOTE CAN STOP NAMING ITS CHAT while the conversation is open: a
  # plugin's builder rewriting its own `README.md` with its file tools takes
  # the front matter with it, and olai's write fence does not reach a tool
  # outside olai. The page says what happened — never that the conversation
  # ended, because it has not — and one press ties it again.
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

  # THE SWITCH IS THE NOTE'S OWN ANSWER, written where a person can read it
  # and a `git pull` can carry it.
  Scenario: The switch says where a note's chat opens, both ways, and the note keeps the answer
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page says it opens "alone"
    When I press the opens switch
    Then the note "notes/plan.md" says it opens "beside"
    And the chat page says it opens "with plan beside"
    # A RELOAD IS THE TEST OF A WRITTEN ANSWER: nothing here is kept in the tab.
    When I reload the page
    Then the chat page says it opens "with plan beside"
    When I press the opens switch
    Then the note "notes/plan.md" says it opens "alone"
    And the chat page says it opens "alone"
    And there should be no page errors

  # AN ADDRESS SOMEBODY WAS HANDED OPENS SOMETHING whatever the vault says: a
  # note with no chat is still its own page, with the door on it.
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

  # THE PALETTE'S AGENT ROWS GO TO THE SAME PAGE, which is the whole of "every
  # door that opens a chat opens the chat".
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
