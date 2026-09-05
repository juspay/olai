@scratch:empty
Feature: A vault whose first outline is broken remains usable
  Scenario Outline: Correcting the only outline recovers from <fault> without reloading
    Given I rewrite "first.olai" as:
      """
      <broken>
      """
    And I open the address "/first.olai"
    And I mark the page
    Then the outline failure shows an error with code "<code>"
    And no outline tree is shown
    When I rewrite "first.olai" as:
      """
      {"id":"first","ord":"a0","title":"the corrected first row"}
      """
    Then the node "first" has the title "the corrected first row"
    When I click the title of "first"
    And I select all and type "edited after recovery"
    And I press "Enter"
    And I press "Escape"
    Then "first.olai" holds a node titled "edited after recovery"
    And the page has not reloaded
    And there should be no page errors

    Examples:
      | fault              | broken                                                                       | code           |
      | invalid JSON       | this is not JSON                                                             | not-json       |
      | a missing parent   | {"id":"first","parent":"missing","ord":"a0","title":"orphan"}         | unknown-parent |

  Scenario: A broken first outline does not prevent creating and editing another
    Given I rewrite "first.olai" as:
      """
      this is not JSON
      """
    And I open the address "/first.olai"
    And I mark the page
    Then the outline failure shows an error with code "not-json"
    When I create the outline "healthy.olai" from the sidebar
    And I start the first line
    And I type "work beside the broken file"
    And I click away from the editor
    Then "healthy.olai" holds a node titled "work beside the broken file"
    And the outline "first.olai" is marked unreadable
    When I open the unreadable outline "first.olai"
    Then the outline failure shows an error with code "not-json"
    When I click the outline "healthy.olai"
    Then the node titled "work beside the broken file" is shown
    And the page has not reloaded
    And there should be no page errors
