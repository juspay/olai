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
    When I reload the page
    Then there are 2 panes
    And pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
    And pane 1 is focused
    And there should be no page errors

  Scenario: A Chats press on a beside note keeps the panes that are already open
    Given the vault holds "notes/plan.md" saying "# Plan"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    And I press the opens switch
    Then the note "notes/plan.md" says it opens "beside"
    When I open the outline "house.olai"
    And I alt-click the zoom of "install"
    Then there are 2 panes
    And pane 1 is focused
    When I press the Chats row "plan-chat"
    Then there are 3 panes
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/notes/plan.md"
    And pane 2 is showing "/chat/notes/plan.md"
    And pane 2 is focused
    And the chat page conversation is ready
    And there should be no page errors

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
    When I focus pane 0
    And I press the Chats row "plan-chat"
    Then there are 3 panes
    And pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
    And pane 2 is showing "/zoom/#install"
    And pane 1 is focused
    And the chat page conversation is ready
    And there should be no page errors

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
    When I press the Chats row "plan-chat"
    Then there are 2 panes
    And pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
    And pane 1 is focused
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
    When I open the outline "house.olai"
    And I alt-click the zoom of "install"
    And I alt-click the zoom of "hinges" in pane 1
    Then there are 3 panes
    When I focus pane 0
    And I press the Chats row "plan-chat"
    Then there are 4 panes
    And pane 0 is showing "/notes/plan.md"
    And pane 1 is showing "/chat/notes/plan.md"
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
    And the chat page offers to open "plan"
    When I press Open beside on the chat page
    Then the pane tabs are shown
    And the pane tabs read "plan · chat | plan"
    When I tap pane tab 0
    Then the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    When I ask the agent "flood"
    And the agent is idle
    And I scroll the page to its end
    Then the pane tabs stay under the header
    And the chat page's head stays in view
    And there should be no page errors

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
    And the chat page offers to open "plan"
    When I press Open beside on the chat page
    Then the pane tabs are shown
    And the pane tabs read "plan · chat | plan"
    And there should be no page errors

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
    And the conversation gets at least 50% of the screen
    When I turn the phone on its side
    And I scroll the page to its end
    Then the conversation gets at least 33% of the screen
    And there should be no page errors

  @phone
  Scenario: On a phone split each tab keeps its place and the chat opens at its end
    Given the vault holds a note long enough to scroll "notes/plan.md"
    And another writer ties a chat to the note "notes/plan.md" as "plan-chat"
    And I open the outline "house.olai"
    When I press the Chats row "plan-chat"
    Then the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    When I ask the agent "flood"
    And the agent is idle
    And I press Open beside on the chat page
    Then the pane tabs read "plan · chat | plan"
    And pane 1 is focused
    When I scroll this tab down a screen
    And I remember where this tab stands
    And I press Alt+Left
    Then this tab is at the end of what it shows
    When I press Alt+Right
    Then this tab stands where it was left
    When I press Alt+Left
    Then this tab is at the end of what it shows
    When I press Alt+Right
    Then this tab stands where it was left
    And there should be no page errors

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
    When I scroll this tab down a screen
    And I remember where this tab stands
    And I press Alt+Left
    When I follow the link "the cabinets note" in the agent's answer
    Then pane 1 is showing "/notes/cabinets.md"
    And pane 1 is focused
    And this tab is at the top of what it shows
    When I go back
    Then pane 1 is showing "/notes/plan.md"
    When I press Alt+Right
    Then this tab stands where it was left
    And there should be no page errors
