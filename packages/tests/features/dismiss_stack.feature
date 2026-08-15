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

  Everything dismissable in this client is on one stack now: the header's two
  popovers, a row's expanded note, the chat's session picker
  (`the_agent.feature` holds that one), and the menu, which joins the stack
  rather than keeping its own. **The last thing opened is the thing a gesture
  is for**, and the one under it is still there for the next gesture — which is
  what a person pressing Escape twice means by it.

  ## Why the menu is opened with the KEYBOARD here

  Not for the keyboard's sake: it is the only door that does not shut the
  popover on the way through. Opening a menu with the `•••` is a pointer down
  outside the panel that is already up, so the popover is correctly gone before
  the menu is there — one panel at a time, and nothing to choose between. A
  press of Enter on a focused `•••` is not a press anywhere, so it leaves what
  was open open. That is what made this path unwalkable while the bug was live
  and is what walks it now.

  Background:
    Given I open the outline "house.jsonl"

  Scenario: Escape shuts the panel on top, and the next Escape the one under it
    When I open the preferences
    And I open the node menu of "kitchen" with the keyboard
    Then the preferences are open
    And the node menu is showing
    # ONE panel goes. The menu was opened last, so the menu is what Escape is
    # about; the preferences are still there because nobody asked for them to
    # go.
    When I press "Escape"
    Then the node menu is closed
    And the preferences are open
    # ...and the next one reaches what is now on top.
    When I press "Escape"
    Then the preferences are shut

  Scenario: A pointer outside follows the same order
    # The same rule, the other gesture. A press outside both panels is a press
    # outside the topmost, and that is the only one it puts away — so the
    # popover underneath survives the press that took the menu off it.
    When I open the preferences
    And I open the node menu of "kitchen" with the keyboard
    Then the preferences are open
    And the node menu is showing
    When I click away from the node menu
    Then the node menu is closed
    And the preferences are open
    When I click away from the node menu
    Then the preferences are shut
