Feature: Plugin settings live under the row
  Row config is what a deployment runs a plugin with — `--commit`, `--push`,
  a pin. Settings are what a person may change while it runs, stored in
  `_olai/Settings.olai`, one node per plugin, drawn under the row. Kolu's
  watch knobs are the first tenant: they used to live on `_olai/Kolu.olai`'s
  `watch` node and they do not any more. No migration; a vault with no kolu
  node in Settings.olai runs the defaults.

  @scratch:good
  Scenario: Kolu's watch knobs are edited on the plugins panel
    Given I open the outline "house.olai"
    When I open the plugins panel
    Then the plugins panel shows "kolu" setting "heartbeat" as "30m"
    And the plugins panel shows "kolu" setting "held-for" as "60s"
    And the plugins panel shows "kolu" setting "nag" as "10m"
    When I set the plugin "kolu" setting "heartbeat" to "10m"
    Then the plugins panel shows "kolu" setting "heartbeat" as "10m"
    And there should be no page errors
