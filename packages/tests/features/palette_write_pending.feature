@scratch:good
Feature: Palette write responses belong to the interaction that sent them
  Scenario: A delayed unpin cannot close a reopened palette
    Given incoming updates to this browser tab can be held
    And I open the node "order"
    When I pin the page
    Then the pinned shelf holds "/#order"
    When I press the palette shortcut
    And I type "Unpin this page" into the palette
    And I hold incoming updates to the original browser tab
    And I press "Enter" without waiting
    And I press "Escape" without waiting
    Then the command palette is closed
    When I press "ControlOrMeta+k" without waiting
    And I type "garden" into the palette
    And I release incoming updates to the original browser tab
    And I wait for the palette write to finish
    Then the command palette is open
    And the palette box holds "garden"
    And "_olai/Pins.olai" no longer holds a node titled "/#order"
    And there should be no page errors

  Scenario Outline: An old write cannot close or annotate a reopened palette
    Given incoming updates to this browser tab can be held
    And I open the node "<node>"
    When I press the palette shortcut
    And I type "<command>" into the palette
    And I hold incoming updates to the original browser tab
    And I press "Enter" without waiting
    And I press "Escape" without waiting
    Then the command palette is closed
    When I press "ControlOrMeta+k" without waiting
    And I type "garden" into the palette
    And I release incoming updates to the original browser tab
    And I wait for the palette write to finish
    Then the command palette is open
    And the palette box holds "garden"
    And the palette has no write response
    And "<file>" holds a node marked <mark> titled "<title>"
    And there should be no page errors

    Examples:
      | node    | command    | file        | mark | title                     |
      | handles | Mark todo  | house.olai  | todo | choose the handles        |
      | demo    | Mark doing | house.olai  | done | take out the old counters |
      | mint    | Complete   | garden.olai | done | split the mint            |

  Scenario: A successful write leaves a newer query in the same palette open
    Given incoming updates to this browser tab can be held
    And I open the node "handles"
    When I press the palette shortcut
    And I type "Mark todo" into the palette
    And I hold incoming updates to the original browser tab
    And I press "Enter" without waiting
    And I type "garden" into the palette
    And I release incoming updates to the original browser tab
    And I wait for the palette write to finish
    Then the command palette is open
    And the palette box holds "garden"
    And "house.olai" holds a node marked todo titled "choose the handles"
    And there should be no page errors
