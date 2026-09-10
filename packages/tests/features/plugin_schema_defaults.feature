@scratch:good @git:repo
Feature: Plugin schemas supply the panel's default policy
  YAML carries no config. The schema declaration supplies the values for
  every configurable row, including an opt-in row and a nested section.

  Scenario: Defaults remain visible without a config block on a bundle row
    Given I open the app
    When I open the plugins panel
    And I expand settings for the plugin "vault"
    And I expand settings for the plugin "git"
    And I expand settings for the plugin "identity"
    And I expand settings for the plugin "chat"
    And I expand settings for the plugin "kolu"
    And I expand settings for the plugin "xyne-spaces"
    When I expand settings for the plugin "vault"
    Then the plugins panel shows "vault" configured "format" as "olai"
    When I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "commit" as "manual"
    When I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "push" as "off"
    When I expand settings for the plugin "identity"
    Then the plugins panel shows "identity" configured "login-header" as "Tailscale-User-Login"
    When I expand settings for the plugin "chat"
    Then the plugins panel shows "chat" configured "idle-ms" as "900000"
    When I expand settings for the plugin "kolu"
    Then the plugins panel shows "kolu" configured "watch.held-for" as "1m"
    When I expand settings for the plugin "xyne-spaces"
    Then the plugins panel shows "xyne-spaces" configured "reply-limit" as "500"
    When I expand settings for the plugin "xyne-spaces"
    Then the plugins panel shows "xyne-spaces" configured "OLAI_SPACES_TOKEN" as "unset"
    And the plugin "xyne-spaces" marks "OLAI_SPACES_TOKEN" as authored by "env"
    And there should be no page errors
