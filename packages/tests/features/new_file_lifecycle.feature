@scratch:good
Feature: New-file drafts survive plugin changes
  Scenario Outline: A typed <kind> filename survives a plugin rebuild and remains creatable
    Given I open the outline "house.olai"
    And I mark the page
    When I open the new <kind> box
    And I fill the new <kind> box with "retained.<suffix>"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the new <kind> box still holds "retained.<suffix>"
    When I submit the new <kind> box while updates are delayed
    Then the file "retained.<suffix>" has been created
    And the address is "/retained.<suffix>"
    And the new <kind> box is gone
    And the page has not reloaded
    And there should be no page errors

    Examples:
      | kind     | suffix |
      | outline  | olai   |
      | document | md     |

  Scenario Outline: A refused <kind> creation stays understandable and correctable after a rebuild
    Given I open the outline "house.olai"
    When I create the <kind> "<existing>" from the sidebar
    Then the <kind> creation is refused saying "already"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the new <kind> box still holds "<existing>"
    And the <kind> creation is refused saying "already"
    When I fill the new <kind> box with "corrected.<suffix>"
    And I submit the new <kind> box while updates are delayed
    Then the file "corrected.<suffix>" has been created
    And the address is "/corrected.<suffix>"
    And there should be no page errors

    Examples:
      | kind     | suffix | existing    |
      | outline  | olai   | house.olai  |
      | document | md     | finishes.md |

  Scenario: Cancelling one retained filename leaves the other file kind intact
    Given I open the outline "house.olai"
    When I fill the new outline box with "abandoned.olai"
    And I fill the new document box with "kept.md"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the new outline box still holds "abandoned.olai"
    And the new document box still holds "kept.md"
    When I fill the new outline box with "abandoned.olai"
    And I press "Escape"
    Then the new outline box is gone
    And the new document box still holds "kept.md"
    When I open the new outline box
    Then the new outline box still holds ""
    And the file "abandoned.olai" has not been created
    When I submit the new document box while updates are delayed
    Then the address is "/kept.md"
    And the new document box is gone
    And there should be no page errors
