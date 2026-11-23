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

  # ...AND THE PANE TO THE RIGHT IS NOT THE PANE IT TAKES. The chat goes in as
  # a NEW column between the note and whatever was next to it: a press in a
  # list of chats opens a conversation, it never closes a page somebody
  # arranged.
  Scenario: A Chats press on a beside note overwrites no pane, with two open
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    And I press the opens switch
    Then the note "notes/plan.md" says it opens "beside"
    When I open the outline "house.olai"
    And I alt-click the zoom of "install"
    Then there are 2 panes
    # THE PRESS LANDS IN THE FIRST PANE, which is the one with a neighbour to
    # lose.
    When I focus pane 0
    And I press the Chats row "plan-chat"
    Then there are 3 panes
    And pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
    And pane 2 is showing "/zoom/#install"
    And pane 1 is focused
    And the chat page conversation is ready
    And there should be no page errors

  # ...AND PRESSED AGAIN IT OPENS NOTHING AT ALL. The note and the
  # conversation are both on screen, which is the whole of what this switch
  # asks for, so a second press has nothing left to open and only goes to the
  # conversation. A press that opened the note again each time grew a column
  # a press, which is the complaint this stands against.
  Scenario: A Chats press on a beside note pressed again changes nothing
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
    # THE SECOND PRESS: the same two panes, in the same order.
    When I press the Chats row "plan-chat"
    Then there are 2 panes
    And pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
    And pane 1 is focused
    # ...AND THE THIRD, from the note's own pane this time.
    When I focus pane 0
    And I press the Chats row "plan-chat"
    Then there are 2 panes
    And pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
    And pane 1 is focused
    And the chat page conversation is ready
    And there should be no page errors

  Scenario: A Chats press on a beside note overwrites no pane, with three open
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    And I press the opens switch
    Then the note "notes/plan.md" says it opens "beside"
    # THREE PANES A READER ARRANGED, and the press lands in the leftmost.
    When I open the outline "house.olai"
    And I alt-click the zoom of "install"
    And I alt-click the zoom of "hinges" in pane 1
    Then there are 3 panes
    When I focus pane 0
    And I press the Chats row "plan-chat"
    Then there are 4 panes
    And pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
    # BOTH OF THE READER'S OTHER COLUMNS ARE STILL THERE, in the order they
    # were in.
    And pane 2 is showing "/zoom/#install"
    And pane 3 is showing "/zoom/#hinges"
    And pane 1 is focused
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

  # WHAT IS LEFT FOR THE CONVERSATION, as a number, upright and on its side —
  # the band from the lowest pinned thing down to the TOP OF THE BOX somebody
  # types in, which is all a person can read.
  #
  # Only the line with the item's name and its door is pinned; the agent line,
  # the tool row and the switches scroll with the chat. Pinning the whole head
  # left about 190 of a portrait handset's 844 pixels for the conversation and
  # covered the box entirely on its side, which is the complaint this
  # measures.
  @phone
  Scenario: On a phone the conversation gets most of the screen, upright and on its side
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    When I ask the agent "flood"
    And the agent is idle
    And I scroll the page to its end
    Then the chat page's head stays in view
    # UPRIGHT: 456 of 844 pixels, about twenty lines.
    And the conversation gets at least 50% of the screen
    # ON ITS SIDE the screen is 390 points tall and the page is past `md`, so
    # it used to wear a desktop's head and a desktop's spacing on a handset:
    # 56 pixels, two lines, between the pinned line and the box. A screen that
    # short takes the display title, the padding over it and the room under
    # the composer back (`short`, `olai-plugin-chat`'s `all.css`), and what is
    # left is 137 pixels of 390 — six lines, which is a conversation.
    When I turn the phone on its side
    And I scroll the page to its end
    Then the conversation gets at least 33% of the screen
    And there should be no page errors

  # EACH TAB KEEPS ITS OWN PLACE. A split on a phone is one page under a strip
  # of tabs, and the window is what scrolls — so without this the note and the
  # conversation shared one scroll: going to the chat landed at the top of it,
  # thousands of pixels above the newest line, and going back and forth
  # drifted.
  @phone
  Scenario: On a phone split each tab keeps its place and the chat opens at its end
    Given the vault holds a note long enough to scroll "notes/plan.md"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    # A CONVERSATION LONGER THAN THE SCREEN, and the note beside it as a tab.
    When I ask the agent "flood"
    And the agent is idle
    And I press Open beside on the chat page
    Then the pane tabs read "plan · chat | plan"
    And pane 1 is focused
    # THE NOTE IS READ PART WAY DOWN and left there.
    When I scroll this tab down a screen
    And I remember where this tab stands
    And I press Alt+Left
    # THE CHAT OPENS AT ITS END, as it does in a column on a desktop.
    Then this tab is at the end of what it shows
    When I press Alt+Right
    Then this tab stands where it was left
    # ...AND BACK AGAIN, both ways, with no drift either way.
    When I press Alt+Left
    Then this tab is at the end of what it shows
    When I press Alt+Right
    Then this tab stands where it was left
    And there should be no page errors

  # ...AND THE PLACE BELONGS TO THE PAGE AS WELL AS THE TAB. A link pressed
  # inside a chat opens in the OTHER tab, which is a NEW page arriving in a
  # tab that was left part way down a note — and a place remembered by tab
  # alone put that new page at the old note's offset, half way into something
  # nobody had read a word of.
  @phone
  Scenario: On a phone a link from the chat opens at the top and the note keeps its place
    Given the vault holds a note long enough to scroll "notes/plan.md"
    And the vault holds a note long enough to scroll "notes/cabinets.md"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    When I ask the agent "links"
    Then the agent's answer mentions "the cabinets note"
    When I press Open beside on the chat page
    Then the pane tabs read "plan · chat | plan"
    And pane 1 is focused
    # THE NOTE IS READ PART WAY DOWN and left there.
    When I scroll this tab down a screen
    And I remember where this tab stands
    And I press Alt+Left
    # THE LINK OPENS ITS NOTE IN THE OTHER TAB — a page that tab has never
    # shown, so it arrives at its first line.
    When I follow the link "the cabinets note" in the agent's answer
    Then pane 1 is showing "/notes/cabinets.md"
    And pane 1 is focused
    And this tab is at the top of what it shows
    # ...AND THE NOTE THAT TAB WAS READING STILL HAS ITS PLACE. Back puts the
    # note in that tab again, and going to it lands on the line the reader
    # left — a place kept by tab alone was the cabinets note's top by then,
    # and the plan started again from its first word.
    When I go back
    Then pane 1 is showing "/notes/plan.md"
    When I press Alt+Right
    Then this tab stands where it was left
    And there should be no page errors
