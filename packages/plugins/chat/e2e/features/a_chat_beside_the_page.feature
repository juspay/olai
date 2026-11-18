@scratch:chat
Feature: A chat opens in the pane beside what it is about
  A conversation has an address now, so it can be a PANE: the thing on the
  left, the agent talking about it on the right. *Open beside ›* is that
  gesture wherever the thing itself is drawn — a row's fold, a node's page,
  the line at the top of a note — and it never takes away the page it was
  pressed on.

  Two promises come with it. A conversation is drawn ONCE: while a pane has
  it, every other place that would draw it says *Shown beside* in one line and
  goes there instead. And a link pressed INSIDE a chat pane opens in the other
  pane — the one to its left, or one opened to its right — because a press on
  a path an agent wrote must not swallow the conversation that wrote it.
  `Alt` keeps its own meaning, and so does a pin: it lands in the focused
  pane, chat or not.

  Scenario: Open beside on a row's fold puts the conversation in the pane to the right
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the chat beside the fold on "install"
    Then there are 2 panes
    # THE ROW'S PANE IS UNTOUCHED: the reader was reading that outline.
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/chat/install"
    And pane 1 is focused
    And the chat page conversation is ready
    # ...and the fold it came out of is one line now.
    And the chat about "install" says it is shown beside
    And the conversation is drawn once
    When I focus pane 0
    And I press Shown beside about "install"
    Then pane 1 is focused
    And there are 2 panes
    And there should be no page errors

  # THE DOOR THAT CAN BE PRESSED FROM THE CHAT ITSELF: the Chats row's
  # two-column button belongs to no pane, so it can be pressed while the chat
  # page IS the focused pane. It goes to the pane that has the conversation —
  # its own included — rather than opening a second column with the same
  # address, which would leave two panes each pointing at the other and the
  # conversation drawn in neither.
  Scenario: The Chats row's beside door pressed on the chat itself opens no second pane
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then there are 1 panes
    And pane 0 is showing "/chat/notes/plan.md"
    And the chat page conversation is ready
    When I press the beside door on the Chats row "plan-chat"
    Then there are 1 panes
    And pane 0 is showing "/chat/notes/plan.md"
    And pane 0 is focused
    And the conversation is drawn once
    And the chat page conversation is ready
    And there should be no page errors

  # THE LAYOUT IS THE ADDRESS, so the split is a thing a reload, a new tab and
  # a pasted link all restore.
  Scenario: A reload restores the split and the conversation in it
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the chat beside the fold on "install"
    Then pane 1 is showing "/chat/install"
    When I reload the page
    Then there are 2 panes
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/chat/install"
    And pane 1 is focused
    And the chat page conversation is ready
    And there should be no page errors

  # THE REGRESSION THIS WHOLE RULE EXISTS FOR: a plain press on a link in a
  # transcript used to replace the pane the transcript was in.
  Scenario: A link in a chat pane lands in the pane beside it, and the conversation stays
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    And I press Open beside on the chat page
    Then pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
    And I mark the page
    When I ask the agent "links"
    Then the agent's answer mentions "the cabinets note"
    When I follow the link "the cabinets note" in the agent's answer
    Then there are 2 panes
    And pane 0 is showing "/notes/cabinets.md"
    And pane 1 is showing "/chat/notes/plan.md"
    And pane 0 is focused
    And the chat page conversation is ready
    And the page has not reloaded
    # ALT STILL MEANS "TO THE RIGHT OF THE PANE I PRESSED IN", which is the
    # only split gesture a reader had before this one.
    When I alt-click the link "the cabinets note" in the agent's answer
    Then there are 3 panes
    And pane 1 is showing "/chat/notes/plan.md"
    And pane 2 is showing "/notes/cabinets.md"
    And there should be no page errors

  # WITH NOTHING ON ITS LEFT a chat opens the column itself — once, and then
  # keeps using it.
  Scenario: A chat alone opens its links in a pane of its own
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then there are 1 panes
    And pane 0 is showing "/chat/notes/plan.md"
    When I ask the agent "links"
    Then the agent's answer mentions "the cabinets note"
    When I follow the link "the cabinets note" in the agent's answer
    Then there are 2 panes
    And pane 0 is showing "/chat/notes/plan.md"
    And pane 1 is showing "/notes/cabinets.md"
    And pane 1 is focused
    When I follow the link "the order row" in the agent's answer
    Then there are 2 panes
    And pane 0 is showing "/chat/notes/plan.md"
    And the unified destination row "order" is selected in pane 1
    And the chat page conversation is ready
    And there should be no page errors

  # A PANE DRAGGED SHUT IS STILL A PANE: it keeps its page and shows a rail
  # with its name on it. *Shown beside* points at exactly that column, so the
  # press has to OPEN it — a press that only moved the caret into a shut
  # column was a press that did nothing a person could see.
  Scenario: Shown beside opens a pane that was dragged shut, and then focuses it
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the chat beside the fold on "install"
    Then there are 2 panes
    And pane 1 is showing "/chat/install"
    When I collapse pane 1 by dragging its divider
    Then a pane rail is shown for pane 1
    When I focus pane 0
    And I press Shown beside about "install"
    Then no pane rail is shown
    And pane 1 is focused
    And pane 1 is showing "/chat/install"
    And the chat page conversation is ready
    And there should be no page errors

  # A PIN IS NOT A LINK IN THE CONVERSATION: it is pressed in the sidebar, and
  # it lands where every pin lands — the focused pane, chat or not.
  Scenario: A pin pressed with the chat pane focused lands in that pane
    Given the directory has the pins:
      | /yard.olai |
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the chat beside the fold on "install"
    Then pane 1 is showing "/chat/install"
    And pane 1 is focused
    When I follow the pin "/yard.olai"
    Then there are 2 panes
    And pane 1 is showing "/yard.olai"
    And pane 1 is focused
    # ...and the fold is a fold again, because nothing is drawing it beside.
    And the fold on "install" offers to open the chat beside
    And there should be no page errors

  # THE OTHER TWO PLACES A CONVERSATION USED TO BE DRAWN, each saying where it
  # went.
  Scenario: The note under a chat pane says the conversation is beside it
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    And I press Open beside on the chat page
    Then pane 0 is showing "/notes/plan.md"
    And the line says the chat is shown beside
    And the conversation is drawn once
    When I focus pane 0
    And I open the chat beside from the line
    Then pane 1 is focused
    And there should be no page errors

  Scenario: A node's page under a chat pane says the conversation is beside it
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I press the Chats row "install"
    Then pane 0 is showing "/chat/install"
    When I press Open beside on the chat page
    Then pane 0 is showing "/zoom/#install"
    And pane 1 is showing "/chat/install"
    And the chat about "install" says it is shown beside
    And the conversation is drawn once
    And there should be no page errors
