@scratch:good @git:repo
Feature: The vault settings file applies policy to running rows
  Each top-level node names a row. Edits pass through the vault's revision
  reader and Cordis reconciles the row; malformed leaves keep defaults.

  Scenario: Editing one leaf preserves valid siblings and updates the panel
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"git-policy","ord":"a0","title":"git","custom":{"commit":"off","push":"off"}}
      """
    And I open the plugins panel
    When I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "commit" as "off"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"git-policy","ord":"a0","title":"git","custom":{"commit":"wrong","push":"off"}}
      """
    When I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "commit" as "manual"
    When I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "push" as "off"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"git-policy","ord":"a0","title":"git","custom":{"commit":"still-wrong","push":"auto"}}
      """
    Then the plugin "git" keeps settings open when "commit" becomes "manual"
    When I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "commit" as "manual"
    When I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "push" as "auto"
    And there should be no page errors

  Scenario: The selected namespace follows file precedence and deletion
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"identity-policy","ord":"a0","title":"identity","custom":{"login-header":"Remote-User"}}
      """
    And I open the plugins panel
    When I expand settings for the plugin "identity"
    Then the plugins panel shows "identity" configured "login-header" as "Remote-User"
    When I rewrite "Settings.olai" as:
      """
      {"id":"near-policy","ord":"a0","title":"identity","custom":{"login-header":"Near-User"}}
      """
    When I expand settings for the plugin "identity"
    Then the plugins panel shows "identity" configured "login-header" as "Near-User"
    When I remove the served file "Settings.olai"
    When I expand settings for the plugin "identity"
    Then the plugins panel shows "identity" configured "login-header" as "Remote-User"
    And there should be no page errors

  Scenario: The file switches a row off and names its decision
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"journal-policy","ord":"a0","title":"journal","custom":{"on":"no"}}
      """
    And I open the plugins panel
    Then the plugins panel says "journal" is "_olai/Settings.olai says on: no"
    And there should be no page errors

  Scenario: A switch authors a durable namespace and links to it
    Given I open the app
    When I open the plugins panel
    Then the plugin "git" keeps settings folded
    When I switch the plugin "journal" off
    Then the plugins panel says "journal" is "_olai/Settings.olai says on: no"
    When I close the plugins panel
    And I open the commit panel
    Then the commit ledger includes the settings switch
    When I leave the app
    And the server stops
    And the server starts again on the same port
    And I open the app
    And I open the plugins panel
    Then the plugins panel says "journal" is "_olai/Settings.olai says on: no"
    And there should be no page errors

  Scenario: Authored controls name their source and the arrow opens the namespace
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"policy-target","ord":"a0","title":"git","custom":{"commit":"off"}}
      """
    And I open the plugins panel
    When I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "commit" as "off"
    And the plugin "git" marks "commit" as authored by "vault"
    When I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "push" as "off"
    And the plugin "git" marks "push" as authored by "default"
    When I follow the policy link for "git"
    Then the policy link targets node "policy-target"
    And there should be no page errors

  Scenario: The node link returns after navigation is restored
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"policy-return","ord":"a0","title":"git","custom":{"commit":"off"}}
      """
    And I open the plugins panel
    When I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "commit" as "off"
    When I switch the plugin "navigation" off
    Then the plugin "git" has no policy link
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"policy-return","ord":"a0","title":"git","custom":{"commit":"off"}}
      {"id":"restore-navigation","ord":"a1","title":"navigation","custom":{"on":"yes"}}
      """
    And I open the plugins panel
    And I follow the policy link for "git"
    Then the policy link targets node "policy-return"
    And there should be no page errors

  Scenario: The reader switch cannot lock durable controls off
    Given I open the app
    When I open the plugins panel
    Then the plugins panel says "settings" is "Switch is session-only"
    When I switch the plugin "settings" off
    Then the plugins panel was started "Switches are session-only while the configuration reader is absent"
    When I switch the plugin "settings" on
    Then the plugins panel says "settings" is "Switch is session-only"
    When I switch the plugin "journal" off
    Then the plugins panel says "journal" is "_olai/Settings.olai says on: no"
    And there should be no page errors

  Scenario: A broken file refuses a durable switch visibly
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {torn line
      """
    And I open the plugins panel
    And I request that the plugin "journal" be off
    Then the plugins panel refuses with "Repair _olai/Settings.olai before changing which tools run."
    And there should be no page errors

  Scenario: A reader-withdrawal settlement refusal reaches the panel
    Given the next switch settlement reports a withdrawn reader
    And I open the app
    When I open the plugins panel
    And I request that the plugin "journal" be off
    Then the plugins panel refuses with "The configuration reader withdrew before the change settled. The file retains the write."
    And there should be no page errors

  Scenario Outline: The agent cannot change durable enablement in either direction
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"reserved-choice","ord":"a0","title":"journal","custom":{"on":"<before>"}}
      {"id":"agent-policy","ord":"a1","title":"git"}
      """
    And I open the plugins panel
    When I expand settings for the plugin "journal"
    Then the plugin "journal" has authored enablement "<before>"
    Given a terminal agent is connected to the served directory
    When the terminal agent sets property "on" on "reserved-choice" to "<after>"
    Then the terminal refusal says "person's decision"
    When I expand settings for the plugin "journal"
    Then the plugin "journal" has authored enablement "<before>"

    When the terminal agent sets property "commit" on "agent-policy" to "off"
    And I expand settings for the plugin "git"
    Then the plugins panel shows "git" configured "commit" as "off"
    And file "_olai/Settings.olai" has namespace "git" setting "commit" as "off"

    Examples:
      | before | after |
      | yes    | no    |
      | no     | yes   |
