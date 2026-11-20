@corpus:good
Feature: Dismiss is one stack, and the topmost answers
  Two panels can be up at once, and a gesture that puts panels away has to
  choose ONE of them. Until this feature existed nothing chose: the `•••` menu
  shut inside `@kobalte/core`'s own layer stack and the panels this client
  draws itself shut through the same library's primitives reached one level
  down (`web/src/client/dismiss.ts`), and the two knew nothing about each
  other. So an Escape with both up shut BOTH — which is not two dismissals, it
  is one keystroke landing twice, and the second panel going with the first is
  a panel nobody put away.

  Everything dismissable in this client is on one stack now (`client/topmost.ts`
  lists them): the header's two popovers, a row's expanded note, the chat's
  sessions popover (`node_agents.feature` holds that one) and the composer's
  completion, the ⌘K palette, and the menu — which joins the stack rather than
  keeping its own.
  **The last thing opened is the thing a gesture is for**, and the one under it
  is still there for the next gesture, which is what a person pressing Escape
  twice means by it.

  Not for the keyboard's sake: it is the only door that does not shut the
  popover on the way through. Opening a menu with the `•••` is a pointer down
  outside the panel that is already up, so the popover is correctly gone before
  the menu is there — one panel at a time, and nothing to choose between. A
  press of Enter on a focused `•••` is not a press anywhere, so it leaves what
  was open open. That is what made this path unwalkable while the bug was live
  and is what walks it now.

  The palette needs no such care, which is why it is here too: `⌘K` fires with
  the caret in a text field, so it opens over whatever was up without a press
  anywhere. That pair was reachable in two keystrokes the whole time.

  Background:
    Given I open the outline "house.olai"

  Scenario: Escape shuts the panel on top, and the next Escape the one under it
    When I open the preferences
    And I open the node menu of "kitchen" with the keyboard
    Then the preferences are open
    And the node menu is open
    When I press "Escape"
    Then the node menu is closed
    And the preferences are open
    When I press "Escape"
    Then the preferences are shut

  Scenario: A pointer outside follows the same order
    When I open the preferences
    And I open the node menu of "kitchen" with the keyboard
    Then the preferences are open
    And the node menu is open
    When I click away from the node menu
    Then the node menu is closed
    And the preferences are open
    When I click away from the node menu
    Then the preferences are shut

  Scenario: The command palette is a layer like any other
    When I open the preferences
    And I press the palette shortcut
    Then the command palette is open
    And the preferences are open
    When I press "Escape"
    Then the command palette is closed
    And the preferences are open
    When I press "Escape"
    Then the preferences are shut

  Scenario: The menu opened FIRST defers to what was opened over it
    # `MenuContentBase` (Kobalte) closes on Escape whether or not the event was
    # prevented, so the refusal is on the menu's own open state.
    When I open the node menu of "kitchen" with the keyboard
    And I focus the preferences trigger
    And I press Enter
    Then the preferences are open
    And the node menu is open
    When I press "Escape"
    Then the preferences are shut
    And the node menu is open
    When I press "Escape"
    Then the node menu is closed

  Scenario: ...and to the palette over it
    When I open the node menu of "kitchen" with the keyboard
    And I press the palette shortcut
    Then the command palette is open
    And the node menu is open
    When I press "Escape"
    Then the command palette is closed
    And the node menu is open
    When I press "Escape"
    Then the node menu is closed

  Scenario: The keyboard-shortcuts dialog answers the key it is about
    When I press the palette shortcut
    And I pick the palette item "Keyboard shortcuts"
    Then the shortcuts are showing
    When I press "Escape"
    Then the shortcuts are put away

  Scenario: ...and its scrim puts away only the palette
    When I open the preferences
    And I press the palette shortcut
    Then the command palette is open
    When I press the palette scrim
    Then the command palette is closed
    And the preferences are open
