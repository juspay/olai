@scratch:good
Feature: An open tag completion follows the vault's current vocabulary
  Background:
    Given I rewrite "tag-source.olai" as:
      """
      {"id":"tag-source","ord":"a0","title":"source #uniqueold @former"}
      """
    And I open the outline "house.olai"
    And I mark the page

  Scenario: Replacing a tag while its prefix is open replaces the offered word
    When I click the title of "handles"
    And I type " #unique"
    Then the completions list "#uniqueold"
    When I rewrite "tag-source.olai" as:
      """
      {"id":"tag-source","ord":"a0","title":"source #uniquenew @former"}
      """
    Then the completions list "#uniquenew"
    And the row being typed holds "choose the handles #unique"
    When I press "Enter"
    And I click away from the editor
    Then "house.olai" holds a node titled "choose the handles #uniquenew"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A disappearing namespace offer recovers without replacing the typed prefix
    When I click the title of "handles"
    And I type " @"
    Then the completions list "@former"
    When I remove the served file "tag-source.olai"
    Then no completions are open
    And the row being typed holds "choose the handles @"
    When I rewrite "tag-source.olai" as:
      """
      {"id":"tag-source","ord":"a0","title":"source #uniquenew @replacement"}
      """
    Then the completions list "@replacement"
    When I press "Enter"
    And I click away from the editor
    Then "house.olai" holds a node titled "choose the handles @replacement"
    And the page has not reloaded
    And there should be no page errors
