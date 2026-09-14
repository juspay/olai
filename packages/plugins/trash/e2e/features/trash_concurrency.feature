@scratch:good
Feature: Emptying the Trash respects changes made in another browser tab
  Background:
    Given incoming updates to this browser tab can be held
    And I rewrite "tasks.olai" as:
      """
      {"id":"first","ord":"a0","title":"first task"}
      {"id":"second","ord":"a1","title":"second task"}
      """
    And I open the outline "tasks.olai"
    When I open the node menu of "first"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    And I open the Trash
    And I press Empty trash

  Scenario: Restoring the last row elsewhere dismisses the destructive question and leaves the row editable
    When I open another browser tab
    And I open the Trash
    And I put back "first" from the Trash
    Then "tasks.olai" holds the node "first"
    When I use the original browser tab
    Then the Trash is empty
    And the Trash is not asking for confirmation
    And the Trash does not offer Empty trash
    When I click the outline "tasks.olai"
    And I click the title of "first"
    And I select all and type "restored from the other tab"
    And I press "Enter"
    Then "tasks.olai" holds a node titled "restored from the other tab"
    And there should be no page errors

  Scenario: A new archived row disarms the old confirmation until the user asks again
    When I open another browser tab
    And I open the outline "tasks.olai"
    And I open the node menu of "second"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "second"
    When I use the original browser tab
    Then the Trash lists the node "second"
    And the Trash is not asking for confirmation
    And "_olai/Trash.olai" holds the node "first"
    When I press Empty trash
    And I confirm emptying the Trash
    Then the Trash is empty
    And "_olai/Trash.olai" holds nothing
    And there should be no page errors

  Scenario: A delayed tab cannot empty a larger pile than the one it confirmed
    When I hold incoming updates to the original browser tab
    And I open another browser tab
    And I open the outline "tasks.olai"
    And I open the node menu of "second"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "second"
    When I use the original browser tab
    And I confirm emptying the Trash while updates are delayed
    And I release incoming updates to the original browser tab
    Then the Trash says "the Trash held 2 records when this was asked for and holds 3 now, so nothing was deleted — something was put away or put back in between. Look again and ask again."
    And "_olai/Trash.olai" holds the node "first"
    And "_olai/Trash.olai" holds the node "second"
    When I press Empty trash
    And I confirm emptying the Trash
    Then the Trash is empty
    And "_olai/Trash.olai" holds nothing
    And there should be no page errors
