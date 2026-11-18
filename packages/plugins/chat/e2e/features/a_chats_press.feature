@scratch:chat
Feature: A press in Chats opens the conversation the way its item says
  The sidebar's **Chats** lists the nodes and notes that have a chat, each
  named by its item. A press opens that chat's page — alone, or, for a note
  whose switch says *beside*, the note on the left with the conversation on
  its right and the focus on the conversation. The layout is the address, so
  the split a press opens is the split a reload restores. A node has nowhere
  to keep a switch, so a node's chat always opens alone.

  A README's chat is named after its folder wherever a chat is named, because
  every plugin's builder chat would otherwise read `README`.

  Scenario: A note whose chat opens alone opens the chat page by itself
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then there are 1 panes
    And the chat page is about the note "notes/plan.md" named "plan"
    And the chat page says it opens "alone"
    And there should be no page errors

  Scenario: A note whose chat opens beside opens the note and the chat together
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    And I press the opens switch
    Then the note "notes/plan.md" says it opens "beside"
    When I open the outline "house.olai"
    And I press the Chats row "plan-chat"
    Then there are 2 panes
    And pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
    And pane 1 is focused
    # THE LAYOUT IS THE ADDRESS: a reload opens the same two panes.
    When I reload the page
    Then there are 2 panes
    And pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
    And pane 1 is focused
    And there should be no page errors

  # ...AND IT DOES NOT TAKE THE READER'S OTHER PANES WITH IT. A *beside* press
  # is the same two verbs *Open beside* spends — the pane it lands in becomes
  # the note, the chat opens to its right — and not a fresh two-pane workspace
  # that replaced whatever was open.
  Scenario: A Chats press on a beside note keeps the panes that are already open
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    And I press the opens switch
    Then the note "notes/plan.md" says it opens "beside"
    # TWO PANES A READER ARRANGED, neither of them about this chat.
    When I open the outline "house.olai"
    And I alt-click the zoom of "install"
    Then there are 2 panes
    And pane 1 is focused
    When I press the Chats row "plan-chat"
    Then there are 3 panes
    # THE OUTLINE IS STILL THERE: nothing closed to make room.
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/notes/plan.md"
    And pane 2 is showing "/chat/notes/plan.md"
    And pane 2 is focused
    And the chat page conversation is ready
    And there should be no page errors

  Scenario: A node's chat opens alone whatever else is on screen
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I press the Chats row "install"
    Then there are 1 panes
    And the chat page is about the node "install" named "install the cabinets" in "house.olai"
    And the chat page has no opens switch
    And there should be no page errors

  Scenario: A README's chat is named after its folder
    Given the vault holds "plugins/swatch/README.md" saying "# Swatch"
    And another writer ties a chat to the note "plugins/swatch/README.md" as "swatch-chat"
    And I open the outline "house.olai"
    Then the Chats row "swatch-chat" reads "swatch" with a file mark
    When I press the Chats row "swatch-chat"
    Then the chat page is about the note "plugins/swatch/README.md" named "swatch"
    And there should be no page errors

  @phone
  Scenario: On a phone the chat is the whole screen, and the way back stays in view
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page is about the note "notes/plan.md" named "plan"
    # BESIDE NAMES NOTHING HERE: the panes are a strip of tabs, so the door
    # reads *Open plan ›* and puts the note in the next tab.
    And the chat page offers to open "plan"
    When I press Open beside on the chat page
    Then the pane tabs are shown
    And the pane tabs read "plan · chat | plan"
    # THE CHAT IS THE FIRST TAB and the note the one the press added, so the
    # way back to the conversation is one tap.
    When I tap pane tab 0
    Then the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    # A CONVERSATION LONGER THAN THE SCREEN, and read to its end — which is
    # the whole of the complaint: the way back must be there at the bottom of
    # a long chat and not only at the top of a short one.
    When I ask the agent "flood"
    And the agent is idle
    And I scroll the page to its end
    Then the pane tabs stay under the header
    And the chat page's head stays in view
    And there should be no page errors

  # ...AND WITH THE CHAT ALONE, which is the default and the case with no
  # strip at all: the page's own head is the way back, so it is the thing that
  # must not scroll away.
  @phone
  Scenario: On a phone the chat alone keeps its way back to the note in view
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then there are 1 panes
    And the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    When I ask the agent "flood"
    And the agent is idle
    And I scroll the page to its end
    Then the chat page's head stays in view
    # ...and the way back is ON that head: one press puts the note in the next
    # tab.
    And the chat page offers to open "plan"
    When I press Open beside on the chat page
    Then the pane tabs are shown
    And the pane tabs read "plan · chat | plan"
    And there should be no page errors

  # THE PHONE HAS ONE PANE AT A TIME, so a chat opened there is the screen: the
  # head, the conversation and the composer are all within it, with nothing to
  # scroll the window itself and the composer against the bottom edge.
  @phone
  Scenario: On a phone the chat page is the whole screen with its composer at the bottom
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then there are 1 panes
    And the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    And the chat page fills the phone screen
    And there should be no page errors
