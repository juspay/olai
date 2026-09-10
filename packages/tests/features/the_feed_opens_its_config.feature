@scratch:good
Feature: The events drawer opens the watch controls
  The optional inspector owns the editor. Its advanced node link still opens
  the file; the feed keeps running when that editor is unavailable.

  Scenario: The wrench opens the row controls and the link beside its name opens its node
    Given I open the outline "house.olai"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"kolu","ord":"a0","title":"kolu"}
      {"id":"watch","parent":"kolu","ord":"a0","title":"watch","custom":{"held-for":"30s"}}
      """
    And I press the padi pill
    Then the drawer offers watch settings
    When I press the drawer's wrench
    Then the drawer is closed
    And the plugins panel shows "kolu" configured "watch.held-for" as "30s"
    When I type "90s" into "kolu" setting "watch.held-for"
    And I press "Enter" in "kolu" setting "watch.held-for"
    Then file "_olai/Settings.olai" has namespace "kolu" setting "watch.held-for" as "90s"
    When I follow the policy link for "kolu"
    Then the policy link targets node "kolu"
    And there should be no page errors

  Scenario: With no file the wrench still opens editable defaults
    Given I open the outline "house.olai"
    When I remove the served file "_olai/Settings.olai"
    And I press the padi pill
    And I press the drawer's wrench
    Then the plugins panel shows "kolu" configured "watch.held-for" as "1m"
    When I type "90s" into "kolu" setting "watch.held-for"
    And I press "Enter" in "kolu" setting "watch.held-for"
    Then file "_olai/Settings.olai" has namespace "kolu" setting "watch.held-for" as "90s"
    And there should be no page errors

  Scenario: A torn file opens the frozen controls and their repair reason
    Given I open the outline "house.olai"
    When I rewrite "_olai/Settings.olai" as:
      """
      {torn line
      """
    And I press the padi pill
    And I press the drawer's wrench
    Then the "kolu" setting "watch.held-for" is frozen because "Repair _olai/Settings.olai before changing settings"
    And there should be no page errors

  Scenario: The optional editor withdraws and reconnects without stopping the feed
    Given I open the outline "house.olai"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"inspector-choice","ord":"a0","title":"plugin-inspector","custom":{"on":"no"}}
      """
    And I press the padi pill
    Then the drawer has no foot
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"inspector-choice","ord":"a0","title":"plugin-inspector","custom":{"on":"yes"}}
      """
    Then the drawer offers watch settings
    When I press the drawer's wrench
    Then the plugins panel shows "kolu" configured "watch.held-for" as "1m"
    And there should be no page errors
