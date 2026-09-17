@scratch:good @git:repo
Feature: Plugin schemas supply the panel's default policy
  YAML carries no config. The schema declaration supplies the values for
  every configurable row, including an opt-in row and a nested section.

  Scenario: Defaults remain visible without a config block on a bundle row
    Given I open the app
    When I open the plugins panel
    Then the plugins panel shows "vault" configured "format" as "outline-olai"
    Then the plugins panel shows "git" configured "commit" as "manual"
    Then the plugins panel shows "git" configured "push" as "off"
    Then the plugins panel shows "identity" configured "login-header" as "Tailscale-User-Login"
    Then the plugins panel shows "chat" configured "idle-ms" as "900000"
    Then the plugins panel shows "kolu" configured "watch.held-for" as "1m"
    Then the plugins panel shows "xyne-spaces" configured "reply-limit" as "500"
    Then the plugins panel shows "xyne-spaces" configured "OLAI_SPACES_TOKEN" as "unset"
    And the plugin "xyne-spaces" marks "OLAI_SPACES_TOKEN" as authored by "env"
    And there should be no page errors
