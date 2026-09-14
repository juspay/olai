@scratch:good
Feature: This serve reads its policy from the vault
  Scenario: The process reading follows file edits without a new socket
    Given I open the outline "house.olai"
    And I mark the page
    When I open the plugins panel
    Then This serve is expanded
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

  Scenario: The log controls author the olai node without restarting the serve
    Given I open the app
    And I mark the page
    When I open the plugins panel
    And I open This serve
    And I remember the settings file "_olai/Settings.olai"
    And I pick "warn" for "olai" setting "log-level"
    Then This serve reads "log-level" as "warn" from "vault"
    And file "_olai/Settings.olai" has namespace "olai" setting "log-level" as "warn"
    When I pick "logfmt" for "olai" setting "log-format"
    Then This serve reads "log-format" as "logfmt" from "vault"
    And file "_olai/Settings.olai" has namespace "olai" setting "log-format" as "logfmt"
    And the same serve process is running
    And the page has not reloaded
    When I use the default for "olai" setting "log-level"
    Then This serve reads "log-level" as "info" from "default"
    And file "_olai/Settings.olai" has namespace "olai" setting "log-level" as "<absent>"
    And there should be no page errors
