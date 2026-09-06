@scratch:good
Feature: Ending a panel resize releases its pointer listeners and retains the reached width
  Background:
    Given I open the outline "house.olai"
    And I mark the page
    When I hold the sidebar resize after widening it by 40px

  Scenario: Escape stops resizing and the reached width survives reload
    When I press "Escape"
    And I move the held resize pointer another 80px
    And I let go
    Then the sidebar retains the width reached before cancellation
    And the page has not reloaded
    When I reload the page
    Then the sidebar retains the width reached before cancellation
    When I drag the sidebar wider by 20px
    Then the sidebar has grown by 20px since the resize was held
    And there should be no page errors

  Scenario: Removing the sidebar owner cancels its resize and a fresh sidebar can resize
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "sidebar" off
    And I use the original browser tab
    Then the sidebar plugin has no rendered column or rail
    When I move the held resize pointer another 80px
    And I use the other browser tab
    And I switch the plugin "sidebar" on
    And I close the plugins panel
    And I use the original browser tab
    Then the sidebar plugin has a rendered column
    When I move the held resize pointer another 80px
    And I let go
    Then the sidebar retains the width reached before cancellation
    When I drag the sidebar wider by 20px
    Then the sidebar has grown by 20px since the resize was held
    And the page has not reloaded
    And there should be no page errors

  Scenario: Removing unrelated chat preserves the in-progress sidebar resize
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    And I use the original browser tab
    Then the conversation is gone-from the header
    When I move the held resize pointer another 80px
    And I let go
    Then the sidebar has grown by 80px since the resize was held
    And the page has not reloaded
    And there should be no page errors
