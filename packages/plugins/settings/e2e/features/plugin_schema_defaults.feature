@scratch:good @git:repo
Feature: Plugin schemas supply the panel's default policy
  YAML carries no config. The schema declaration supplies the values for
  every configurable row, including an opt-in row and a nested section.

  Scenario: Defaults remain visible without a config block on a bundle row
    Given I open the app
    When I open the plugins panel
    And I expand the plugin "vault"
    Then the plugins panel shows "vault" configured "format" as "outline-olai"
    When I expand the plugin "git"
    Then the plugins panel shows "git" configured "commit" as "manual"
    Then the plugins panel shows "git" configured "push" as "off"
    When I expand the plugin "identity"
    Then the plugins panel shows "identity" configured "login-header" as "Tailscale-User-Login"
    When I expand the plugin "chat"
    Then the plugins panel shows "chat" configured "idle-ms" as "172800000"
    When I expand the plugin "kolu"
    Then the plugins panel shows "kolu" configured "watch.held-for" as "1m"
    When I expand the plugin "xyne-spaces"
    Then the plugins panel shows "xyne-spaces" configured "reply-limit" as "500"
    Then the plugins panel shows "xyne-spaces" configured "OLAI_SPACES_TOKEN" as "unset"
    And the plugin "xyne-spaces" marks "OLAI_SPACES_TOKEN" as authored by "env"
    And there should be no page errors
