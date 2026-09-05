@scratch:good
Feature: New-file forms keep the next filename while an earlier write is pending
  Scenario Outline: A late refusal does not annotate the corrected filename
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I open the new <kind> box
    And I fill the new <kind> box with "<existing>"
    And I hold incoming updates to the original browser tab
    And I submit the new <kind> box while updates are delayed
    And I fill the new <kind> box with "corrected.<suffix>"
    And I release incoming updates to the original browser tab
    Then the new <kind> box is ready
    And the new <kind> box still holds "corrected.<suffix>"
    And the new <kind> box has no refusal
    When I submit the new <kind> box while updates are delayed
    Then the address is "/corrected.<suffix>"
    And the new <kind> box is gone
    And there should be no page errors

    Examples:
      | kind     | suffix | existing    |
      | outline  | olai   | house.olai  |
      | document | md     | finishes.md |

  Scenario Outline: Dismissing and reopening the form makes a new draft
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I open the new <kind> box
    And I fill the new <kind> box with "first.<suffix>"
    And I hold incoming updates to the original browser tab
    And I submit the new <kind> box while updates are delayed
    And I press "Escape"
    Then the new <kind> box is gone
    When I open the new <kind> box
    And I fill the new <kind> box with "second.<suffix>"
    And I release incoming updates to the original browser tab
    Then the new <kind> box is ready
    And the new <kind> box still holds "second.<suffix>"
    And the file "second.<suffix>" has not been created
    When I submit the new <kind> box while updates are delayed
    Then the address is "/second.<suffix>"
    And the new <kind> box is gone
    And there should be no page errors

    Examples:
      | kind     | suffix |
      | outline  | olai   |
      | document | md     |

  Scenario Outline: Pending creation cannot submit or discard the next filename
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I open the new <kind> box
    And I fill the new <kind> box with "first.<suffix>"
    And I hold incoming updates to the original browser tab
    And I submit the new <kind> box while updates are delayed
    And I fill the new <kind> box with "second.<suffix>"
    And I submit the new <kind> box while updates are delayed
    And I release incoming updates to the original browser tab
    Then the address is "/first.<suffix>"
    And the new <kind> box still holds "second.<suffix>"
    And the file "second.<suffix>" has not been created
    When I submit the new <kind> box while updates are delayed
    Then the address is "/second.<suffix>"
    And the new <kind> box is gone
    And there should be no page errors

    Examples:
      | kind     | suffix |
      | outline  | olai   |
      | document | md     |
