@corpus:good
Feature: The palette is a modal the browser owns
  The ⌘K palette and the keyboard-shortcuts sheet it opens used to be `fixed`
  boxes with `role="dialog"` on them, a hand-written Tab trap, a full-screen
  button for a scrim, and a page underneath that was covered but never inert.
  Every one of those is something the platform does better: they are native
  `<dialog>`s opened with `showModal()` now
  (`navigation/src/palette/Palette.tsx`).

  What that is worth is four promises this feature holds, because each of them
  was previously a line of code that could rot: the page behind really cannot
  be touched, the keyboard cannot leave the panel and goes back where it came
  from, a press outside puts it away and a press inside does not, and the one
  thing that may stand OVER it — the offline freeze — still does.

  Background:
    Given I open the outline "house.olai"

  Scenario: The page behind an open palette cannot be reached
    When I press the palette shortcut
    Then the command palette is open
    And the page behind the palette is out of reach
    When I press where the filter box is
    Then the command palette is closed
    And the filter box never took the caret

  Scenario: Escape gives the keyboard back to where it came from
    When I type "kitchen" into the filter box
    And I press the palette shortcut
    Then the command palette is open
    When I press "Escape"
    Then the command palette is closed
    And the keyboard is back in the filter box

  Scenario: A press inside the sheet stays, a press outside puts it away
    When I press the palette shortcut
    And I press the palette's own edge
    Then the command palette is open
    When I press the palette scrim
    Then the command palette is closed

  Scenario: The freeze still covers an open palette, and the palette survives it
    When I press the palette shortcut
    Then the command palette is open
    When the browser goes offline
    Then the app is frozen under the offline overlay
    And the palette is sealed under the offline overlay
    When the browser comes back online
    Then the overlay is gone
    And the command palette is open
    And the palette box has the caret

  Scenario: A row that navigates hands nothing back
    When I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    When I press the palette shortcut
    And I type "hinges" into the palette
    And I pick the palette item "hinges"
    Then the unified destination row "hinges" is selected
    And the caret is not back in the row editor

  Scenario: The shortcuts sheet is a modal of its own
    When I press the palette shortcut
    And I pick the palette item "Keyboard shortcuts"
    Then the shortcuts are showing
    And the page behind the shortcuts sheet is out of reach
    When I press outside the shortcuts sheet
    Then the shortcuts are put away

  Scenario: The sheet gives the caret back to where the reader came from
    When I type "kitchen" into the filter box
    And I press the palette shortcut
    And I pick the palette item "Keyboard shortcuts"
    Then the shortcuts are showing
    When I press "Escape"
    Then the shortcuts are put away
    And the keyboard is back in the filter box

  Scenario: There is no door at all while the wire is dead
    When the browser goes offline
    Then the app is frozen under the offline overlay
    When I press the palette shortcut
    Then the command palette does not open
    And the app is frozen under the offline overlay
    When the browser comes back online
    Then the overlay is gone
    When I press the palette shortcut
    Then the command palette is open
    And the palette box has the caret

  Scenario: Without `closedby`, the fallback answers the same three ways
    Given this browser has no light dismiss of its own
    When I press the palette shortcut
    And I press the palette's own edge
    Then the command palette is open
    When I drag from inside the palette onto the scrim
    Then the command palette is open
    When I press the palette scrim
    Then the command palette is closed

  @scratch:good
  Scenario: Without `closedby`, a press outside answers the question first
    Given this browser has no light dismiss of its own
    And I open the node "install"
    When I press the palette shortcut
    And I choose "Move to Trash" from the palette
    Then the palette asks "Move “install the cabinets” and the 3 rows under it to Trash? You can put them back from Trash in the sidebar."
    When I press the palette scrim
    Then the palette is not asking anything
    And the command palette is open
    And "house.olai" holds a node titled "install the cabinets"
