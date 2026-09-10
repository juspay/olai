@scratch:good
Feature: A structural reply respects leaving the editor
  Scenario: Escape between a split reply and its page frame cancels the deferred editor
    Given outline page revisions can be held after their writes reply
    And I open the outline "house.olai"
    And I show the done nodes
    When I click the title of "handles"
    And I put the caret after "choose"
    And I hold the next outline page revision
    And I press "Enter"
    Then "house.olai" holds a node titled " the handles"
    When I press "Escape"
    And I release the held outline page revision
    Then the node "handles" has the title "choose"
    When I press "ControlOrMeta+z"
    Then the node "handles" has the title "choose the handles"
    And "house.olai" no longer holds a node titled " the handles"
    And there should be no page errors

  Scenario: Escape while the split reply is pending cannot reopen the editor
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    And I show the done nodes
    When I click the title of "handles"
    And I put the caret after "choose"
    And I hold incoming updates to the original browser tab
    And I press "Enter" without waiting
    Then "house.olai" holds a node titled " the handles"
    When I press "Escape" without waiting
    And I release incoming updates to the original browser tab
    Then the node "handles" has the title "choose"
    When I press "ControlOrMeta+z"
    Then the node "handles" has the title "choose the handles"
    And "house.olai" no longer holds a node titled " the handles"
    And there should be no page errors
