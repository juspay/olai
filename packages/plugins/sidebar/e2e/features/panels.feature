Feature: The sidebar and command palette

  @corpus:good
  Scenario: Collapsing the sidebar leaves an icon rail
    Given I open the outline "house.olai"
    Then the sidebar is open on desktop
    When I collapse the sidebar
    Then the sidebar rail is showing
    And the outline "house.olai" is still on screen
    When I expand the sidebar from the rail
    Then the sidebar is open on desktop

  @corpus:good
  Scenario: Dragging the sidebar handle changes its width
    Given I open the outline "house.olai"
    When I drag the sidebar wider by 40px
    Then the sidebar is at least 40px wider than the default
    When I reload the page
    Then the sidebar width survived the reload

  @no-agent @scratch:chat
  Scenario: A palette > ask that fails is shown, not swallowed
    Given I open the app
    When I press the palette shortcut
    And I ask the palette "> please do the thing"
    Then the palette shows an ask error
    And the command palette is open

  @corpus:good
  Scenario: The command palette opens from the keyboard
    Given I open the outline "house.olai"
    When I press the palette shortcut
    Then the command palette is open
    When I pick the palette item "Toggle sidebar"
    Then the sidebar rail is showing

  @corpus:good
  Scenario: The header's search box is the other door to the same reading
    # One reading, two doors: the box asks the same server procedure the
    # palette does and draws the same rows, so a result pressed here behaves
    # exactly as one pressed there.
    Given I open the outline "house.olai"
    When I search the header for "hinges"
    Then the header search lists the node "pick the hinges"
    When I press the header search result "pick the hinges"
    Then the address is "/#hinges"
    And the zoomed node is "hinges"

  @corpus:good
  Scenario: Palette search finds a node and jumps to it
    # The query goes to the server's search procedure — the same reading an
    # agent's search_nodes gets, so the palette and an agent cannot answer
    # differently for the same words.
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "hinges" into the palette
    Then the palette lists the node "pick the hinges"
    When I pick the palette item "pick the hinges"
    Then the address is "/#hinges"
    And the zoomed node is "hinges"

  @corpus:good
  Scenario: Keyboard toggles the sidebar
    Given I open the outline "house.olai"
    When I press the sidebar shortcut
    Then the sidebar rail is showing
    When I press the sidebar shortcut
    Then the sidebar is open on desktop

  @corpus:good @phone
  Scenario: On a phone the directory is a fixed drawer under the header
    Given I open the outline "house.olai"
    Then the sidebar is put away
    When I tap the burger
    Then the directory drawer is open with a scrim
    And the header chrome stays tappable over the drawer
    When I tap the directory scrim
    Then the sidebar is put away
