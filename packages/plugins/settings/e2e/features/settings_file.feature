@scratch:good @git:repo
Feature: The vault settings file applies policy to running rows
  A scenario that reads git's **promoted** settings — `commit` and `push` are drawn in the
  preferences panel — pins that panel off (`@rows-off:preferences`), which is the row's
  own fallback: with no preferences panel the inspector draws those controls itself.
  `promoted_settings.feature` holds the promoted path.

  Each top-level node names a row. Edits pass through the vault's revision
  reader and Cordis reconciles the row; malformed leaves keep defaults.

  Scenario: Editing one leaf preserves valid siblings and updates the panel
    # A PROMOTED LEAF IS DRAWN IN THE PREFERENCES PANEL (git's `commit` and
    # `push` are), so that is where the decoded value is read. Each rewrite
    # replaces the whole file, which is why these read the promoted rows rather
    # than pinning Preferences off in every block.
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"git-policy","ord":"a0","title":"git","custom":{"commit":"off","push":"off"}}
      """
    And I open the preferences
    Then the preference "plugin-git-commit" shows "off"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"git-policy","ord":"a0","title":"git","custom":{"commit":"wrong","push":"off"}}
      """
    Then the preference "plugin-git-commit" shows "manual"
    And the preference "plugin-git-push" shows "off"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"git-policy","ord":"a0","title":"git","custom":{"commit":"still-wrong","push":"auto"}}
      """
    Then the preference "plugin-git-commit" shows refused file text "still-wrong" inline with default "manual"
    And the preference "plugin-git-push" shows "auto"
    And there should be no page errors

  Scenario: The selected namespace follows file precedence and deletion
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"identity-policy","ord":"a0","title":"identity","custom":{"login-header":"Remote-User"}}
      """
    And I open the plugins panel
    And I expand the plugin "identity"
    Then the plugins panel shows "identity" configured "login-header" as "Remote-User"
    When I rewrite "Settings.olai" as:
      """
      {"id":"near-policy","ord":"a0","title":"identity","custom":{"login-header":"Near-User"}}
      """
    Then the plugins panel shows "identity" configured "login-header" as "Near-User"
    When I remove the served file "Settings.olai"
    Then the plugins panel shows "identity" configured "login-header" as "Remote-User"
    And there should be no page errors

  Scenario: The file switches a row off and names its decision
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"journal-policy","ord":"a0","title":"journal","custom":{"on":"no"}}
      """
    And I open the plugins panel
    Then the plugin "journal" is off without prose
    And there should be no page errors

  @rows-off:preferences
  Scenario: A switch authors a durable namespace and links to it
    Given I open the app
    When I open the plugins panel
    And I expand the plugin "git"
    Then the plugin "git" has inline controls
    When I switch the plugin "journal" off
    Then the plugin "journal" is off without prose
    When I close the plugins panel
    And I open the commit panel
    Then the commit ledger includes the settings switch
    When I leave the app
    And the server stops
    And the server starts again on the same port
    And I open the app
    And I open the plugins panel
    Then the plugin "journal" is off without prose
    And there should be no page errors

  Scenario: The header opens the file and section headings count their switches
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"header-policy","ord":"a0","title":"git","custom":{"commit":"manual"}}
      """
    And I open the plugins panel
    Then the plugins panel section counts match their switches
    When I open the settings file from the panel header
    Then the address names the settings file
    And there should be no page errors

  Scenario: Authored controls name their source and the arrow opens the namespace
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"policy-target","ord":"a0","title":"git","custom":{"commit":"off"}}
      """
    And I open the preferences
    Then the preference "plugin-git-commit" shows "off"
    And the preference "plugin-git-commit" is marked as authored by "vault"
    And the preference "plugin-git-push" shows "off"
    And the preference "plugin-git-push" is marked as authored by "default"
    When I open the plugins panel
    And I follow the policy link for "git"
    Then the policy link targets node "policy-target"
    And there should be no page errors

  Scenario: The node link returns after navigation is restored
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"policy-return","ord":"a0","title":"git","custom":{"commit":"off"}}
      """
    And I open the preferences
    Then the preference "plugin-git-commit" shows "off"
    When I open the plugins panel
    And I switch the plugin "navigation" off
    Then the plugin "git" has no policy link
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"policy-return","ord":"a0","title":"git","custom":{"commit":"off"}}
      {"id":"restore-navigation","ord":"a1","title":"navigation","custom":{"on":"yes"}}
      """
    And I open the plugins panel
    And I expand the plugin "git"
    And I follow the policy link for "git"
    Then the policy link targets node "policy-return"
    And there should be no page errors

  Scenario: The reader switch cannot lock durable controls off
    Given I open the app
    When I open the plugins panel
    Then the plugin "settings" has a session-only switch ring
    When I switch the plugin "settings" off
    Then every plugin enable switch has a session-only ring
    When I switch the plugin "settings" on
    Then the plugin "settings" has a session-only switch ring
    When I switch the plugin "journal" off
    Then the plugin "journal" is off without prose
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
    And I expand the plugin "git"
    Then file "_olai/Settings.olai" has namespace "journal" setting "on" as "<before>"
    Given a terminal agent is connected to the served directory
    When the terminal agent sets property "on" on "reserved-choice" to "<after>"
    Then the terminal refusal says "person's decision"
    And file "_olai/Settings.olai" has namespace "journal" setting "on" as "<before>"

    When the terminal agent sets property "commit" on "agent-policy" to "off"
    Then the preference "plugin-git-commit" shows "off"
    And file "_olai/Settings.olai" has namespace "git" setting "commit" as "off"

    Examples:
      | before | after |
      | yes    | no    |
      | no     | yes   |
