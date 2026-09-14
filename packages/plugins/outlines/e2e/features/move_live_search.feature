@scratch:good
Feature: An open move picker follows changes to its destinations
  Scenario: Replacing a destination updates the picker and the resulting cross-file move remains undoable
    Given I rewrite "destinations.olai" as:
      """
      {"id":"old-destination","ord":"a0","title":"orchid old destination"}
      """
    And I open the outline "house.olai"
    And I mark the page
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "orchid"
    And I point the move picker at "orchid old destination"
    And I rewrite "destinations.olai" as:
      """
      {"id":"new-destination","ord":"a0","title":"orchid new destination"}
      """
    And I point the move picker at "orchid new destination"
    And I choose "orchid new destination" from the move picker
    Then the node "knobs" in "destinations.olai" sits under "new-destination"
    And "house.olai" no longer holds the node "knobs"
    And no move picker is open
    When I press "ControlOrMeta+z"
    Then the node "knobs" in "house.olai" sits under "install"
    And "destinations.olai" no longer holds the node "knobs"
    And the page has not reloaded
    And there should be no page errors
