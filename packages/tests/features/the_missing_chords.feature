@corpus:good
Feature: The rest of Workflowy's chords

  The outliner's loop already has the keys for writing and moving rows
  (`keyboard_editing.feature`). What hands coming from Workflowy still reach
  for are the PAGE chords: zoom into the row the caret is in and back out, fold
  the branch it names, flip whether finished work is drawn here, and — on a
  Mac — move a row with ⌘⇧↑/↓, the way the OS trained them. Each is a key put
  on an act that already existed: the bullet's zoom page, the triangle's fold,
  the strip's Done flip.

  Scenario: Alt+. zooms into the row the caret is in
    Given I open the outline "house.olai"
    When I click the title of "install"
    And I press "Alt+."
    Then the address is "/#install"
    And the zoomed node is "install"
    And there should be no page errors

  Scenario: Alt+, zooms out to the row's parent
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I press "Alt+,"
    Then the address is "/#install"
    And the zoomed node is "install"
    And there should be no page errors

  Scenario: Alt+, on a zoomed page's own rows pops the zoom itself
    Given I open the node "install"
    When I click the title of "handles"
    And I press "Alt+,"
    Then the address is "/#kitchen"
    And there should be no page errors

  Scenario: Alt+, on a whole outline's own rows has no page to go to
    Given I open the outline "house.olai"
    When I click the title of "kitchen"
    And I press "Alt+,"
    Then the address is "/house.olai"
    And there should be no page errors

  Scenario: Ctrl+Space folds and unfolds the branch the caret is in
    Given I open the outline "garden.olai"
    When I click the title of "herbs"
    Then the node "mint" is shown
    When I press "Control+Space"
    Then the node "mint" is not shown
    When I press "Control+Space"
    Then the node "mint" is shown

  Scenario: Ctrl+↑ folds a branch and Ctrl+↓ unfurls it
    Given I open the outline "garden.olai"
    When I click the title of "frames"
    And I press "Control+ArrowUp"
    Then the node "slugs" is not shown
    When I press "Control+ArrowDown"
    Then the node "slugs" is shown

  Scenario: Ctrl+O shows this page's finished work, and hides it again
    Given I open the outline "house.olai"
    Then the node "demo" is not shown
    When I press "Control+o"
    Then the node "demo" is shown
    When I press "Control+o"
    Then the node "demo" is not shown

  @share-scratch
  @scratch:good
  Scenario: ⌘⇧ moves a row on a Mac, as Workflowy trained the hands
    Given this browser says it is on a Mac
    When I open the outline "house.olai"
    And I click the title of "knobs"
    And I press "Meta+Shift+ArrowUp"
    Then the node "knobs" comes before "hinges"
