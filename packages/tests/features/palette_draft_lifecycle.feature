@scratch:good
Feature: Palette drafts survive plugin changes
  Scenario: A pin rename stays saveable after another tab changes plugins
    Given the directory has the pins:
      | /#order |
    And I open the outline "house.olai"
    And I mark the page
    When I rename the pin "/#order"
    And I type "Kitchen project draft" into the palette
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the palette asks "a name for this pin — Enter with nothing takes the name off"
    And the palette box holds "Kitchen project draft"
    When I click the palette box
    And I press "Enter"
    Then the pin "/#order" is named "Kitchen project draft"
    And "Pins.olai" holds a node titled "[Kitchen project draft](/#order)"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Dismissing a retained pin name starts a clean rename next time
    Given the directory has the pins:
      | /#order |
    And I open the outline "house.olai"
    When I rename the pin "/#order"
    And I type "abandoned name" into the palette
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the palette box holds "abandoned name"
    When I press "Escape"
    And I press "Escape"
    And I rename the pin "/#order"
    Then the palette box holds ""
    When I name the pin "Final name"
    Then the pin "/#order" is named "Final name"
    And "Pins.olai" holds a node titled "[Final name](/#order)"
    And there should be no page errors

  Scenario: A capture draft remains sendable after the palette is rebuilt
    Given I open the outline "house.olai"
    And I mark the page
    When I press the palette shortcut
    And I type "+ retained capture draft" into the palette
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the palette box holds "+ retained capture draft"
    When I click the palette box
    And I press "Enter"
    Then "_olai/Inbox.olai" holds a node titled "retained capture draft"
    And the page has not reloaded
    And there should be no page errors
