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
  Scenario: The rail's icons say what they open in the app's own tip
    # The rail is glyphs alone, and the words that go with them used to be the
    # platform's `title` — placed by the browser, and answered to a pointer
    # and nothing else. They are this app's tip now, and the primitive those
    # buttons are cannot draw one (its package declares `solid-js`, and the
    # tip's package declares IT), so each caller wraps the button it drew.
    # Hence this scenario: it is the shared mechanism rather than one surface.
    #
    # The name is asserted BESIDE the tip because the two are different jobs
    # done with different words — "Files" is what a pointer reads, "Open
    # files" is what the button is called — and the tip is only allowed to
    # be a convenience while the name goes on saying the door. The column has
    # one list of files, so the rail has one icon for them.
    Given I open the outline "house.olai"
    When I collapse the sidebar
    Then the sidebar rail is showing
    And the rail has one icon for the files
    When I hover the rail's "files" icon
    Then a tip says "Files"
    And the rail's "files" icon is named "Open files"
    And the rail's "files" icon carries no native tooltip
    # The second hover proves the one-tip rule across two owners: the first
    # tip is gone, not merely covered.
    When I hover the rail's "expand" icon
    Then a tip says "Expand sidebar"
    And the rail's "expand" icon is named "Expand sidebar"
    And the rail's "expand" icon carries no native tooltip
    And there should be no page errors

  @corpus:good
  Scenario: Dragging the sidebar handle changes its width
    Given I open the outline "house.olai"
    When I drag the sidebar wider by 40px
    Then the sidebar is at least 40px wider than the default
    When I reload the page
    Then the sidebar width survived the reload

  @corpus:good
  Scenario: The command palette opens from the keyboard
    Given I open the outline "house.olai"
    When I press the palette shortcut
    Then the command palette is open
    When I pick the palette item "Toggle sidebar"
    Then the sidebar rail is showing

  @corpus:good
  Scenario: The header's search button opens the same palette
    # One reading, one drawing of it: the button opens the palette the chord
    # opens, so a result picked there behaves exactly as one picked after ⌘K.
    Given I open the outline "house.olai"
    When I search from the header for "hinges"
    Then the palette lists the node "pick the hinges"
    When I pick the palette item "pick the hinges"
    Then the unified destination row "hinges" is selected

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
    Then the unified destination row "hinges" is selected
    And the unified destination row "hinges" is selected

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
