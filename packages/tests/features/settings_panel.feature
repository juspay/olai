@scratch:good
Feature: Edit plugin settings on the panel
  The controls write the vault file. The summary reads the effective policy.

  Scenario: The keyboard opens a disclosure before entering its controls
    Given I open the app
    When I open the plugins panel
    And I focus the enable switch for "kolu"
    And I press "Tab"
    Then the "kolu" configuration disclosure has focus
    When I press "Enter"
    And I press "Tab"
    Then the "kolu" setting "watch.held-for" has focus
    When I type "90s" into "kolu" setting "watch.held-for"
    And I press "Enter" in "kolu" setting "watch.held-for"
    Then file "_olai/Settings.olai" has namespace "kolu" setting "watch.held-for" as "90s"
    And there should be no page errors

  @git:repo
  Scenario: Enable git, choose Auto, see the write in the ledger and keep it across a restart
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"git-panel","ord":"a0","title":"git","custom":{"on":"no"}}
      """
    And I open the plugins panel
    Then the plugins panel says "git" is "_olai/Settings.olai says on: no"
    When I switch the plugin "git" on
    Then the plugin "git" has summary "Commit: Manual · Push: Off — using defaults"
    And the plugin "git" line has only its labelled enable switch
    When I expand settings for the plugin "git"
    And I pick "auto" for "git" setting "commit"
    Then the plugins panel shows "git" configured "commit" as "auto"
    And the plugin "git" marks "commit" as authored by "vault"
    And file "_olai/Settings.olai" has namespace "git" setting "commit" as "auto"
    When I close the plugins panel
    And I open the commit panel
    Then the commit ledger includes the "git" settings namespace
    When I leave the app
    And the server stops
    And the server starts again on the same port
    And I open the app
    And I open the plugins panel
    And I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "commit" as "auto"
    And there should be no page errors

  Scenario: A section edit creates its nodes, rejects a bare number, and Use default removes the key
    Given I open the app
    When I open the plugins panel
    And I expand settings for the plugin "kolu"
    Then the "kolu" setting "watch.held-for" suggests "a non-negative duration with a unit"
    When I type "90s" into "kolu" setting "watch.held-for"
    And I press "Enter" in "kolu" setting "watch.held-for"
    Then file "_olai/Settings.olai" has namespace "kolu" setting "watch.held-for" as "90s"
    And the plugin "kolu" marks "watch.held-for" as authored by "vault"
    When I remember the settings file "_olai/Settings.olai"
    And I type "90" into "kolu" setting "watch.held-for"
    And I press "Enter" in "kolu" setting "watch.held-for"
    Then the "kolu" setting "watch.held-for" problem says "spell a number and a unit"
    And the remembered settings file is unchanged
    When I press "Escape" in "kolu" setting "watch.held-for"
    Then the plugins panel shows "kolu" configured "watch.held-for" as "90s"
    And the "kolu" setting "watch.held-for" has no problem
    When I type "90" into "kolu" setting "watch.held-for"
    And I use the default for "kolu" setting "watch.held-for"
    Then file "_olai/Settings.olai" has namespace "kolu" setting "watch.held-for" as "<absent>"
    And the plugins panel shows "kolu" configured "watch.held-for" as "1m"
    And the plugin "kolu" marks "watch.held-for" as authored by "default"
    And there should be no page errors

  Scenario: An unrelated revision preserves a draft and two tabs settle on the last accepted edit
    Given I open the app
    When I open the plugins panel
    And I expand settings for the plugin "kolu"
    And I type "90s" into "kolu" setting "watch.held-for"
    And I rewrite "_olai/Settings.olai" as:
      """
      {"id":"draft-kolu","ord":"a0","title":"kolu"}
      {"id":"draft-watch","ord":"a0","parent":"draft-kolu","title":"watch","custom":{"heartbeat":"2m"}}
      """
    Then the plugins panel shows "kolu" configured "watch.heartbeat" as "2m"
    And the plugins panel shows "kolu" configured "watch.held-for" as "90s"
    When I leave "kolu" setting "watch.held-for"
    Then file "_olai/Settings.olai" has namespace "kolu" setting "watch.held-for" as "90s"
    When I open another browser tab
    And I open the plugins panel
    And I expand settings for the plugin "kolu"
    And I type "2m" into "kolu" setting "watch.held-for"
    And I press "Enter" in "kolu" setting "watch.held-for"
    Then file "_olai/Settings.olai" has namespace "kolu" setting "watch.held-for" as "2m"
    When I use the original browser tab
    Then the plugins panel shows "kolu" configured "watch.held-for" as "2m"
    When I press "ArrowLeft" in "kolu" setting "watch.held-for"
    And I rewrite "_olai/Settings.olai" as:
      """
      {"id":"draft-kolu","ord":"a0","title":"kolu"}
      {"id":"draft-watch","ord":"a0","parent":"draft-kolu","title":"watch","custom":{"held-for":"3m","heartbeat":"2m"}}
      """
    Then the plugins panel shows "kolu" configured "watch.held-for" as "3m"
    And there should be no page errors

  Scenario: A refused hand-written leaf shows the file text, schema message and effective default
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"kolu-panel","ord":"a0","title":"kolu"}
      {"id":"watch-panel","ord":"a0","parent":"kolu-panel","title":"watch","custom":{"held-for":"60"}}
      """
    And I open the plugins panel
    And I expand settings for the plugin "kolu"
    Then the "kolu" setting "watch.held-for" problem says "File says \"60\""
    And the "kolu" setting "watch.held-for" problem says "spell a number and a unit"
    And the "kolu" setting "watch.held-for" problem says "using 1m"
    And the plugin "kolu" has summary "Watch held for: 1m · Watch nag: 10m · Watch heartbeat: 30m — using defaults · 1 invalid"
    When I use the default for "kolu" setting "watch.held-for"
    Then the "kolu" setting "watch.held-for" has no problem
    And file "_olai/Settings.olai" has namespace "kolu" setting "watch.held-for" as "<absent>"
    And there should be no page errors

  @rows-off:settings
  Scenario: An absent reader freezes knobs and enabling it restores editing
    Given I open the app
    When I open the plugins panel
    And I switch the plugin "settings" off
    And I expand settings for the plugin "kolu"
    Then the "kolu" setting "watch.held-for" is frozen because "Settings can be edited when the configuration reader is running"
    When I switch the plugin "settings" on
    And I expand settings for the plugin "kolu"
    And I type "90s" into "kolu" setting "watch.held-for"
    And I press "Enter" in "kolu" setting "watch.held-for"
    Then file "_olai/Settings.olai" has namespace "kolu" setting "watch.held-for" as "90s"
    And there should be no page errors

  Scenario: A broken file freezes knobs and repairing it restores editing
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {torn line
      """
    And I remember the settings file "_olai/Settings.olai"
    And I open the plugins panel
    And I expand settings for the plugin "kolu"
    Then the "kolu" setting "watch.held-for" is frozen because "Repair _olai/Settings.olai before changing settings"
    And the remembered settings file is unchanged
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"repair-policy","ord":"a0","title":"kolu"}
      """
    And I type "90s" into "kolu" setting "watch.held-for"
    And I press "Enter" in "kolu" setting "watch.held-for"
    Then file "_olai/Settings.olai" has namespace "kolu" setting "watch.held-for" as "90s"
    And there should be no page errors
