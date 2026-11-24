Feature: The sidebar reads in one order, and its buttons wait for a pointer
  The column reads where to go (Agenda, Today, the inbox), what needs you,
  your own things (the pinned pages, then the files), then the conversations,
  then the plugins, with Trash pinned at the foot. Chats and Plugins are lists
  a person goes to on purpose, so they stand below the files; a section a
  plugin adds without saying where stands above them.

  Every `+` and chevron in the column is drawn while the pointer is in the
  column or the keyboard is on it, and always on a touch screen. At rest the
  column is names and counts.

  @corpus:good
  Scenario: On a desktop the files come before the chats and the plugins
    Given I open the outline "house.olai"
    Then the sidebar reads, top to bottom:
      | Agenda  |
      | Today   |
      | Files   |
      | Chats   |
      | Plugins |
      | Trash   |
    And there should be no page errors

  @corpus:good @phone
  Scenario: The phone's drawer reads in the same order
    Given I open the outline "house.olai"
    When I tap the burger
    Then the sidebar reads, top to bottom:
      | Agenda  |
      | Today   |
      | Files   |
      | Chats   |
      | Plugins |
      | Trash   |
    And there should be no page errors

  @scratch:good
  Scenario: The inbox and the pinned pages stand above the files
    Given I open the outline "house.olai"
    And the directory has the pins:
      | /zoom/#order |
    When I press the palette shortcut
    And I capture "call the joiner" from the palette
    And I close the palette
    Then the sidebar reads, top to bottom:
      | Agenda  |
      | Today   |
      | Inbox   |
      | Pinned  |
      | Files   |
      | Chats   |
      | Plugins |
    And there should be no page errors

  # What needs you stands above your own files: an agent waiting on a person
  # is the one thing in the column that is owed now, and the Chats list it
  # comes from stays below the files.
  @scratch:chat
  Scenario: A chat waiting on you stands above the files, and Chats below them
    Given I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent" from the node menu
    And the node agent's fold is ready
    And I ask the agent "ask"
    Then the chat shows a question
    And Needs you lists "install"
    And the sidebar reads, top to bottom:
      | Needs you |
      | Files     |
      | Chats     |
    And there should be no page errors

  # Chats and Plugins hold their places when the other is gone.
  @scratch:good
  Scenario: With chat off, or with the directory's plugins off, what remains keeps its order
    Given I open the outline "house.olai"
    When I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    Then the sidebar draws no "Chats"
    And the sidebar reads, top to bottom:
      | Agenda  |
      | Files   |
      | Plugins |
      | Trash   |
    When I open the plugins panel
    And I switch the plugin "chat" on
    And I switch the plugin "vault-plugins" off
    And I close the plugins panel
    Then the sidebar draws no "Plugins"
    And the sidebar reads, top to bottom:
      | Agenda |
      | Files  |
      | Chats  |
      | Trash  |
    And there should be no page errors

  @corpus:good
  Scenario Outline: The "<control>" button waits for a pointer, and the keyboard reaches it
    Given I open the outline "house.olai"
    When the pointer is away from the sidebar
    Then the sidebar's "<control>" control is not drawn
    When the pointer is in the sidebar
    Then the sidebar's "<control>" control is drawn
    When the pointer is away from the sidebar
    And I Tab to the sidebar's "<control>" control
    Then the sidebar's "<control>" control has the keyboard, and is drawn
    And there should be no page errors

    Examples:
      | control                 |
      | New outline or document |
      | Show month              |
      | New chat                |
      | New plugin              |

  @corpus:good @phone
  Scenario: A wide touch screen draws the column's buttons at rest
    Given I open the outline "house.olai"
    When I widen the window to a desk
    Then the sidebar's "New outline or document" control is drawn
    And the sidebar's "Show month" control is drawn
    And the sidebar's "New chat" control is drawn
    And there should be no page errors
