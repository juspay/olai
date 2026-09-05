@scratch:good
Feature: New-file forms keep the next filename while an earlier write is pending
  Scenario Outline: Browser Back during creation keeps the restored history entry
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I click the outline "garden.olai"
    And I open the new <kind> box
    And I fill the new <kind> box with "created.<suffix>"
    And I hold incoming updates to the original browser tab
    And I submit the new <kind> box while updates are delayed
    And I go back
    And I release incoming updates to the original browser tab
    Then the new <kind> box is gone
    And the address is "/house.olai"
    And the file "created.<suffix>" has been created
    And there should be no page errors

    Examples:
      | kind     | suffix |
      | outline  | olai   |
      | document | md     |

  Scenario Outline: Closing the initiating pane does not redirect its surviving neighbor
    Given incoming updates to this browser tab can be held
    And I open the address "/s/house.olai/garden.olai"
    When I focus pane 0
    And I open the new <kind> box
    And I fill the new <kind> box with "created.<suffix>"
    And I hold incoming updates to the original browser tab
    And I submit the new <kind> box while updates are delayed
    And I close the focused pane
    And I release incoming updates to the original browser tab
    Then the new <kind> box is gone
    And the address is "/garden.olai"
    And the file "created.<suffix>" has been created
    And there should be no page errors

    Examples:
      | kind     | suffix |
      | outline  | olai   |
      | document | md     |

  Scenario: A document created after leaving opens for reading on a later visit
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I open the new document box
    And I fill the new document box with "created.md"
    And I hold incoming updates to the original browser tab
    And I submit the new document box while updates are delayed
    And I follow the outline "garden.olai" while updates are delayed
    And I release incoming updates to the original browser tab
    Then the new document box is gone
    And the address is "/garden.olai"
    When I click the document "created.md"
    Then the document open is "created.md"
    And the document editor is gone
    When I start editing the document
    Then the document editor is open
    And there should be no page errors

  Scenario Outline: A late creation response does not take the newly focused pane
    Given incoming updates to this browser tab can be held
    And I open the address "/s/house.olai/garden.olai"
    When I focus pane 0
    And I open the new <kind> box
    And I fill the new <kind> box with "created.<suffix>"
    And I hold incoming updates to the original browser tab
    And I submit the new <kind> box while updates are delayed
    And I focus pane 1
    And I release incoming updates to the original browser tab
    Then the new <kind> box is gone
    And pane 1 is focused
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/garden.olai"
    And the file "created.<suffix>" has been created
    And there should be no page errors

    Examples:
      | kind     | suffix |
      | outline  | olai   |
      | document | md     |

  Scenario Outline: A late creation response does not replace explicit navigation
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I open the new <kind> box
    And I fill the new <kind> box with "created.<suffix>"
    And I hold incoming updates to the original browser tab
    And I submit the new <kind> box while updates are delayed
    And I follow the outline "garden.olai" while updates are delayed
    And I release incoming updates to the original browser tab
    Then the new <kind> box is gone
    And the address is "/garden.olai"
    And the file "created.<suffix>" has been created
    And there should be no page errors

    Examples:
      | kind     | suffix |
      | outline  | olai   |
      | document | md     |

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
