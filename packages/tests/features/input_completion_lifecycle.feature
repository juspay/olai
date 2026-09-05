@scratch:good
Feature: Input completion choices survive rebuilding the same draft
  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: A dismissed date completion stays dismissed when the editor rebuilds
    When I click the title of "handles"
    And I type " !tom"
    Then the date completions are open
    When I press "Escape"
    Then no completions are open
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    And I use the original browser tab
    Then the conversation is gone-from the header
    And the row being typed holds "choose the handles !tom"
    And no completions are open
    When I type "orrow is prose"
    And I click away from the editor
    Then "house.olai" holds a node titled "choose the handles !tomorrow is prose"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A mirror query stays usable when the editor rebuilds
    When I click the title of "knobs"
    And I type " ((compost"
    Then the mirror completions are open
    And the completions include "the compost heap"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    And I use the original browser tab
    Then the conversation is gone-from the header
    And the mirror completions are open
    And the completions include "the compost heap"
    When I press "Enter"
    Then "house.olai" holds a mirror of "compost" under "install"
    And the row being typed holds "pick the knobs"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then "house.olai" holds no mirror of "compost"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Arrow movement after typing determines where text continues after a rebuild
    When I click the title of "handles"
    And I select all and type "abcde"
    And I press "ArrowLeft"
    And I press "ArrowLeft"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    And I use the original browser tab
    Then the conversation is gone-from the header
    When I type "|"
    And I click away from the editor
    Then "house.olai" holds a node titled "abc|de"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds a node titled "choose the handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A new edit on the same row starts with completion offers enabled
    When I click the title of "handles"
    And I type " !tom"
    Then the date completions are open
    When I press "Escape"
    And I press "Escape"
    Then no row is being edited
    When I click the title of "handles"
    And I type " !tom"
    Then the date completions are open
    When I press "Enter"
    Then "house.olai" holds the node "handles" dated tomorrow
    And the row being typed holds "choose the handles"
    And the page has not reloaded
    And there should be no page errors
