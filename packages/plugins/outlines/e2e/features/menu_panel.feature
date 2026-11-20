@corpus:good
Feature: The ••• menu opens and shuts
  The panel itself, rather than what its verbs do (`menu_verbs.feature`) or the
  gutter it hangs in (`workflowy_gutter.feature`): the ways a person puts it
  away, and the keyboard that walks it.

  It is a `@kobalte/core` DropdownMenu — the SolidJS ecosystem's accessible
  primitive — where it used to be this client's fourth hand-rolled dismissable
  panel. Everything below was true of the hand-rolled one and untested (the
  three dismissals), or is what adopting the primitive BOUGHT (the arrow keys,
  which the hand-rolled list deliberately did not implement and said so). Both
  halves belong here: a swap nothing holds to the old behaviour is a swap that
  can quietly change it.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes

  Scenario: Escape hands the caret back to the •••
    When I open the node menu of "kitchen" with the keyboard
    And I press "Escape"
    Then the node menu is closed
    And the node menu of "kitchen" has the caret

  Scenario: A pointer outside is NOT handed the caret back
    When I open the node menu of "kitchen" with the keyboard
    And I click away from the node menu
    Then the node menu is closed
    And the caret is nowhere

  Scenario: The keyboard opens it, reaches an entry, and chooses
    Given I mark the page
    When I open the node menu of "kitchen" with the keyboard
    And I press "Home"
    And I press "Enter"
    Then the zoomed node is "kitchen"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The question takes the caret, and Cancel hands it back
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    Then the node menu's "Move to Trash" has the caret
    When I choose "Cancel" from the node menu
    Then the node menu is not asking anything
    And the node menu's "Move to Trash" has the caret

  Scenario: ArrowDown walks the entries in order
    When I open the node menu of "kitchen" with the keyboard
    And I press "Home"
    And I press "ArrowDown"
    Then the node menu's "Mark" has the caret
    And the node menu's "Mark" is closed
    When I press "ArrowDown"
    Then the node menu's "Set date…" has the caret

  Scenario: A click on a submenu's entry opens it beside the panel
    When I open the node menu of "kitchen"
    And I open "Mark" in the node menu
    Then the node menu's "Mark" offers:
      | To do     |
      | Done      |
      | Cancelled |
      | Clear     |
    And the node menu is open
    And there should be no page errors

  Scenario: More holds the rarely reached, in its own order
    When I open the node menu of "install"
    And I open "More" in the node menu
    Then the node menu's "More" offers:
      | Copy link       |
      | Copy as text    |
      | Expand all      |
      | Collapse all    |
      | Add property…   |
      | Link to…        |
      | Wait for…       |

  Scenario: ArrowRight walks into a submenu, ArrowLeft back out to its entry
    When I open the node menu of "kitchen" with the keyboard
    And I press "End"
    And I press "ArrowUp"
    Then the node menu's "More" has the caret
    When I press "ArrowRight"
    Then the node menu's "More" is open
    And the node menu's "Copy link" has the caret
    When I press "ArrowLeft"
    Then the node menu's "More" is closed
    And the node menu's "More" has the caret
    When I press "Escape"
    Then the node menu is closed
    And the node menu of "kitchen" has the caret

  Scenario: Enter on a verb inside a submenu chooses it, and the whole menu goes
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen" with the keyboard
    And I press "End"
    And I press "ArrowUp"
    And I press "ArrowRight"
    And I press "ArrowDown"
    And I press "ArrowDown"
    And I press "ArrowDown"
    Then the node menu's "Collapse all" has the caret
    When I press "Enter"
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    And the node menu is closed

  Scenario: The keyboard reaches Move to Trash last, and it asks before it moves anything
    When I open the node menu of "install" with the keyboard
    And I press "End"
    Then the node menu's "Move to Trash" has the caret
    When I press "Enter"
    Then the node menu asks "Move “install the cabinets” and the 3 rows under it to Trash? You can put them back from Trash in the sidebar."
    And the node menu's "Move to Trash" has the caret
    When I press "Escape"
    Then the node menu is closed

  Scenario: A row opened a SECOND time still puts the caret in the panel
    Given I mark the page
    When I open the node menu of "kitchen" with the keyboard
    And I press "Escape"
    And I open the node menu of "kitchen" with the keyboard
    And I press "Home"
    And I press "Enter"
    Then the zoomed node is "kitchen"
    And the page has not reloaded
    And there should be no page errors

  Scenario: An open menu paints over a later section heading
    Given I zoom into the node "kitchen"
    When I open the node menu of "order"
    Then the node menu takes the pointer where it crosses the section heading of "install"
    And there should be no page errors

  Scenario: A refusal paints over a later section heading
    Given I zoom into the node "kitchen"
    When I open the node menu of "demo"
    And I choose "Mark › Doing" from the node menu
    Then the node menu of "demo" says "`take out the old counters` is done. Undo that first — nothing should decide on your behalf that finished work is not finished."
    And the node menu's said line takes the pointer where it crosses the section heading of "order"
    And there should be no page errors
