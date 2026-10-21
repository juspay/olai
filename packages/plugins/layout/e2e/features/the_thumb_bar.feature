Feature: The thumb bar — a phone's four doors at the foot of the screen

  A phone has no sidebar on screen and no ⌘K, so everything a person does
  most — look at today, see what is owed, find the agent that is waiting on
  them, write a thought down — was a burger, a scroll and a tap away. The
  frame pins a bar to the foot of a phone's screen (`layout.thumbs`, in
  `src/Frame.tsx`) and the plugins that own those four doors put a thumb in
  it: journal's Today and Agenda, chat's Chats, capture's `+`. A desktop has
  the sidebar and the palette and draws no bar.

  @phone
  Scenario: A phone draws the four thumbs at the foot of the screen
    Given I open the outline "house.olai"
    Then the thumb bar holds "Today Agenda Chats Capture"
    And the thumb bar is a finger's height at the foot of the screen
    And the frame reserves the thumb bar's height under the page
    And there should be no page errors

  Scenario: A desktop draws no thumb bar
    Given I open the outline "house.olai"
    Then there is no thumb bar
    And there should be no page errors

  @phone
  Scenario: Today and Agenda are one tap away, and the one open is lit
    Given I open the outline "house.olai"
    Then no thumb is current
    When I tap the thumb "Today"
    Then the day open is today
    And the thumb "Today" is current
    And the thumb "Agenda" is not current
    When I tap the thumb "Agenda"
    Then the agenda page is open
    And the thumb "Agenda" is current
    And the thumb "Today" is not current
    And there should be no page errors

  @phone
  Scenario: The Chats thumb opens the drawer on the conversations
    Given I open the outline "house.olai"
    Then the Chats thumb counts nobody
    When I tap the thumb "Chats"
    Then the directory drawer is open with a scrim
    And there should be no page errors

  @phone @scratch:chat
  Scenario: The Chats thumb counts the agents waiting on a person and lands on them
    Given I open the outline "house.olai"
    When I hold a finger on the node "install"
    Then the node menu is open
    When I choose "Start an agent" from the node menu
    Then the panel header names the node agent "install the cabinets"
    When I ask the agent "ask"
    Then the chat shows a question
    And the Chats thumb counts 1 waiting
    When I tap the thumb "Chats"
    Then the directory drawer is open with a scrim
    And the caret is on Needs you
    And there should be no page errors

  @phone @scratch:empty
  Scenario: The Capture thumb is a line in the Inbox in two taps
    Given I open the app
    And I mark the page
    When I tap the thumb "Capture"
    Then the command palette is open
    And the palette box reads "+ "
    When I type "milk, and the good kind" into the palette box
    And I press "Enter" in the palette
    Then "_olai/Inbox.olai" holds exactly 1 node titled "milk, and the good kind"
    And the page has not reloaded
    And there should be no page errors
