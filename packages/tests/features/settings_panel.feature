@scratch:good
Feature: Edit plugin settings on the panel
  The controls write the vault file and remain visible beside their row names.

  Scenario: The square panel exposes controls and the keyboard reaches the next row's knob
    Given I open the app
    When I open the plugins panel
    Then the plugins panel is square and has no horizontal overflow
    And the plugin "vault" has inline controls
    And the plugin "git" has inline controls
    And the plugin "kolu" has inline controls
    When I focus the enable switch for "settings"
    And I press "Tab"
    Then the first choice of "git" setting "commit" has focus
    And there should be no page errors

  Scenario: Escape discards an uncommitted draft without dismissing the panel
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"escape-kolu","ord":"a0","title":"kolu"}
      {"id":"escape-watch","ord":"a0","parent":"escape-kolu","title":"watch","custom":{"held-for":"2m"}}
      """
    And I open the plugins panel
    Then the plugins panel shows "kolu" configured "watch.held-for" as "2m"
    When I remember the settings file "_olai/Settings.olai"
    And I type "90s" into "kolu" setting "watch.held-for"
    And I press "Escape" in "kolu" setting "watch.held-for"
    Then the plugins panel remains open
    And the plugins panel shows "kolu" configured "watch.held-for" as "2m"
    And the "kolu" setting "watch.held-for" has focus
    When I leave "kolu" setting "watch.held-for"
    Then the remembered settings file is unchanged
    And there should be no page errors

  @git:repo
  Scenario: Enable git, choose Auto, see the write in the ledger and keep it across a restart
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"git-panel","ord":"a0","title":"git","custom":{"on":"no"}}
      """
    And I open the plugins panel
    Then the plugin "git" is off without prose
    When I switch the plugin "git" on
    Then the plugin "git" line has only its labelled enable switch
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
    Then the plugins panel shows "git" configured "commit" as "auto"
    And there should be no page errors

  Scenario: A section edit creates its nodes, rejects a bare number, and Use default removes the key
    Given I open the app
    When I open the plugins panel
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

  Scenario: A refused file value is alarmed inline while its default remains in force
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"kolu-panel","ord":"a0","title":"kolu","custom":{"on":"no"}}
      {"id":"watch-panel","ord":"a0","parent":"kolu-panel","title":"watch","custom":{"nag":"10"}}
      """
    And I open the plugins panel
    Then the plugin "kolu" is off without prose
    And the "kolu" setting "watch.nag" shows refused file text "10" inline with default "10m"
    And the "kolu" setting "watch.nag" problem says "spell a number and a unit"
    When I use the default for "kolu" setting "watch.nag"
    Then the "kolu" setting "watch.nag" has no problem
    And file "_olai/Settings.olai" has namespace "kolu" setting "watch.nag" as "<absent>"
    And there should be no page errors

  Scenario: Refused choices and numbers retain the actual file spelling in the input
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"bad-choice","ord":"a0","title":"git","custom":{"commit":"sometimes"}}
      {"id":"bad-number","ord":"a1","title":"chat","custom":{"idle-ms":"whenever"}}
      """
    And I open the plugins panel
    Then the "git" setting "commit" shows refused file text "sometimes" inline with default "manual"
    And the "chat" setting "idle-ms" shows refused file text "whenever" inline with default "900000"
    When I use the default for "git" setting "commit"
    Then the "git" setting "commit" has no problem
    And the plugin "git" has inline controls
    And there should be no page errors

  @rows-off:settings
  Scenario: An absent reader freezes knobs and enabling it restores editing
    Given I open the app
    When I open the plugins panel
    And I switch the plugin "settings" off
    Then the "kolu" setting "watch.held-for" is frozen because "Settings can be edited when the configuration reader is running"
    When I switch the plugin "settings" on
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

  @phone
  Scenario: The phone panel uses one column without horizontal overflow
    Given I open the app
    When I tap the burger
    And I open the plugins panel
    Then the plugins panel has one column and fits the phone
    And the plugin "git" has inline controls
    And there should be no page errors
