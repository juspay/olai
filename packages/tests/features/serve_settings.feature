@scratch:good
Feature: This serve reads its policy from the vault
  Scenario: The collapsed process reading follows file edits without a new socket
    Given I open the outline "house.olai"
    And I mark the page
    When I open the plugins panel
    Then This serve is collapsed
    When I open This serve
    Then This serve names its bound address and a set bearer without its value
    And This serve reads "log-level" as "info" from "default"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"process-policy","ord":"a0","title":"olai","custom":{"log-level":"debug","log-format":"logfmt"}}
      """
    Then This serve reads "log-level" as "debug" from "vault"
    And This serve reads "log-format" as "logfmt" from "vault"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"process-policy","ord":"a0","title":"olai","custom":{"log-level":"loud"}}
      """
    Then This serve reads "log-level" as "info" from "default"
    And the page has not reloaded
    And there should be no page errors
