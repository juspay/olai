@scratch:good
Feature: Undo follows an edit whose acknowledgement has not reached the browser
  Scenario: Undo after leaving a note waits for its pending save
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    And I mark the page
    When I open the note of "order"
    And I click the note of "order"
    And I type " — measured twice"
    And I hold incoming updates to the original browser tab
    And I click away from the editor
    Then "house.olai" holds a node whose note ends "— measured twice"
    When I press "ControlOrMeta+z" without waiting
    And I release incoming updates to the original browser tab
    Then "house.olai" holds a node whose note ends "before ordering."
    When I press "ControlOrMeta+Shift+z"
    Then "house.olai" holds a node whose note ends "— measured twice"
    And the page has not reloaded
    And there should be no page errors

  Scenario: An older title edit is not spent while a note save waits for its reply
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I click the title of "knobs"
    And I select all and type "previous title edit"
    And I press "Enter"
    And I press "Escape"
    Then the node "knobs" has the title "previous title edit"
    When I open the note of "order"
    And I click the note of "order"
    And I type " — measured twice"
    And I hold incoming updates to the original browser tab
    And I click away from the editor
    Then "house.olai" holds a node whose note ends "— measured twice"
    When I press "ControlOrMeta+z" without waiting
    And I release incoming updates to the original browser tab
    Then "house.olai" holds a node whose note ends "before ordering."
    And the node "knobs" has the title "previous title edit"
    When I press "ControlOrMeta+z"
    Then the node "knobs" has the title "pick the knobs"
    And there should be no page errors

  Scenario: A late note save does not repopulate history after leaving its file
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    And I mark the page
    When I open the note of "order"
    And I click the note of "order"
    And I type " — measured twice"
    And I hold incoming updates to the original browser tab
    And I click away from the editor
    Then "house.olai" holds a node whose note ends "— measured twice"
    When I follow the outline "garden.olai" while updates are delayed
    And I release incoming updates to the original browser tab
    And I press "ControlOrMeta+z"
    Then the undo says "nothing to undo"
    And "house.olai" holds a node whose note ends "— measured twice"
    When I click the outline "house.olai"
    And I press "ControlOrMeta+z"
    Then the undo says "nothing to undo"
    And "house.olai" holds a node whose note ends "— measured twice"
    And the page has not reloaded
    And there should be no page errors
