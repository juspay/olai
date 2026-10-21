@corpus:lanes
Feature: A conversation can be kept beside the page
  A conversation lives on its row — unfolded under it, or on the node's own
  page. The AGENT PANEL is the same conversation read BESIDE the page: a
  column on the right of the reading that stays where it is while the reader
  moves between outlines, so reading what an agent is working on and talking
  to it are one activity rather than two pages.

  The column is the shell's (`olai-plugin-layout`'s seat): whether it is open
  is remembered by this browser, its width is dragged like the sidebar's, and
  ⌘J / Ctrl+J shows or hides it. WHICH conversation is in it is chat's, and is
  remembered too, so a reload brings the same agent back. With nothing docked
  the column offers every chat as a picker. A phone has no seat: the fold and
  the page are its faces, and none of the panel's doors are drawn there.

  Scenario: A Chats row opens its conversation beside the page
    Given I open the outline "lanes.olai"
    When I open the agent "door-live" in the panel
    Then the agent panel shows "door-live"
    And the agent panel's conversation is ready
    And the page is still the outline "lanes.olai"
    And the agent panel toggle is pressed
    And there should be no page errors

  Scenario: The panel is the same conversation, and the composer in it works
    Given I open the outline "lanes.olai"
    When I open the agent "door-live" in the panel
    And the agent panel's conversation is ready
    And I ask the agent "hello"
    Then the chat shows my message "hello"
    And the agent's answer mentions "you said: hello"
    And there should be no page errors

  Scenario: The panel stays while the reader moves between pages
    Given I open the outline "lanes.olai"
    When I open the agent "door-live" in the panel
    And the agent panel's conversation is ready
    And I open the outline "backlog.olai"
    Then the agent panel shows "door-live"
    And the page is still the outline "backlog.olai"
    And there should be no page errors

  Scenario: ⌘J hides the panel and shows it again, and a reload keeps it
    Given I open the outline "lanes.olai"
    And I mark the page
    When I open the agent "door-live" in the panel
    And I press the agent panel chord
    Then the agent panel is hidden
    And the agent panel toggle is not pressed
    When I press the agent panel chord
    Then the agent panel shows "door-live"
    And the page has not reloaded
    When I reload the page
    Then the agent panel shows "door-live"
    And there should be no page errors

  Scenario: The bar's toggle and the panel's own close are the other two doors
    Given I open the outline "lanes.olai"
    When I open the agent "door-live" in the panel
    And I close the agent panel
    Then the agent panel is hidden
    When I press the agent panel toggle
    Then the agent panel shows "door-live"
    And there should be no page errors

  Scenario: Switching docks another conversation in the same column
    Given I open the outline "lanes.olai"
    When I open the agent "door-live" in the panel
    And I open the agent "door-review" in the panel
    Then the agent panel shows "door-review"
    When I switch the agent panel to "door-live"
    Then the agent panel shows "door-live"
    And there should be no page errors

  Scenario: An agent line offers the panel, and the panel's title opens the page
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    When I open this conversation in the panel from its agent line
    Then the agent panel shows "door-live"
    When I press the agent panel's title
    Then the page is the agent "door-live"
    And there should be no page errors

  Scenario: The palette and the shortcuts sheet know the chord
    Given I open the outline "lanes.olai"
    When I press the palette shortcut
    And I type "agent panel" into the palette
    Then the palette offers "Show agent panel"
    When I choose "Show agent panel" from the palette
    Then the agent panel offers a conversation to open
    When I press the palette shortcut
    And I type "keyboard shortcuts" into the palette
    And I choose "Keyboard shortcuts" from the palette
    Then the shortcuts are showing
    And the shortcuts list "Show or hide the agent panel" as "⌘J / Ctrl+J"
    And there should be no page errors

  Scenario: With nothing docked the panel offers every chat
    Given I open the outline "lanes.olai"
    When I press the agent panel toggle
    Then the agent panel offers a conversation to open
    When I pick "door-live" from the agent panel
    Then the agent panel shows "door-live"
    And there should be no page errors

  Scenario: The panel's width is dragged, and the drag survives a reload
    Given I open the outline "lanes.olai"
    And I mark the page
    When I open the agent "door-live" in the panel
    And I drag the agent panel wider by 80px
    Then the agent panel has grown by 80px
    When I reload the page
    Then the agent panel has grown by 80px
    And there should be no page errors

  @phone
  Scenario: A phone has no panel and none of its doors
    Given I open the outline "lanes.olai"
    Then the agent panel is absent on this phone
    And there should be no page errors
