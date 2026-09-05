@scratch:good
Feature: Renaming a pin does not replace changes made while its question was open
  Scenario Outline: A stale name cannot overwrite a pin's <change>
    Given the directory has the pins:
      | /#order |
    And I open the outline "house.olai"
    When I rename the pin "/#order"
    And I type "My proposed name" into the palette
    And I rewrite "Pins.olai" as:
      """
      {"id":"p0","ord":"a0","title":"<replacement>"}
      """
    Then the pin "<address>" is named "Other writer"
    When I click the palette box
    And I press "Enter"
    Then the palette says "has been retitled since"
    And "Pins.olai" holds a node titled "<replacement>"
    And the palette box holds "My proposed name"
    When I press "Escape"
    And I press "Escape"
    And I rename the pin "<address>"
    And I name the pin "Reviewed name"
    Then the pin "<address>" is named "Reviewed name"
    And "Pins.olai" holds a node titled "[Reviewed name](<address>)"
    And there should be no page errors

    Examples:
      | change      | replacement                    | address      |
      | name        | [Other writer](/#order)         | /#order      |
      | destination | [Other writer](/garden.olai)    | /garden.olai |
