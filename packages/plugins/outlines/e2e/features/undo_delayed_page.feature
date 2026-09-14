@scratch:good
Feature: Leaving an editor while a structural page update is delayed
  Scenario Outline: A late structural frame cannot reclaim the caret after a click away
    Given outline page revisions can be held after their writes reply
    And I open the outline "house.olai"
    When I click the title of "knobs"
    And I hold the next outline page revision
    And I press "<key>"
    And I click away from the editor
    And I release the held outline page revision
    Then the node "knobs" is a child of "<parent>"
    And no title editor remains after clicking away
    When I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"
    And there should be no page errors

    Examples:
      | key       | parent  |
      | Shift+Tab | kitchen |
      | Tab       | hinges  |
