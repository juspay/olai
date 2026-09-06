@scratch:good
Feature: Directory features have independent browser lifetimes
  Feature withdrawal preserves a surviving editor and the address being read.
  Sidebar presentation can leave while content and navigation continue.

  Scenario Outline: A directory feature can leave and return without replacing a draft
    Given I open the outline "house.olai"
    And I mark the page
    When I click the title of "handles"
    And I select all and type "abcde"
    And I press "ArrowLeft"
    And I press "ArrowLeft"
    And I mark every element of the row "handles"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "<feature>" off
    And I use the original browser tab
    Then the row "handles" kept every element it had
    When I type "|"
    And I use the other browser tab
    And I switch the plugin "<feature>" on
    And I use the original browser tab
    Then the row "handles" kept every element it had
    When I click away from the editor
    Then "house.olai" holds a node titled "abc|de"
    And the page has not reloaded
    And there should be no page errors

    Examples:
      | feature |
      | files   |
      | pins    |
      | capture |
      | trash   |
      | chat    |
