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
    Then the plugins panel shows "git" configured "commit" as "off"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"git-policy","ord":"a0","title":"git","custom":{"commit":"wrong","push":"off"}}
      """
    Then the plugin "git" keeps defaults open when "commit" becomes "manual"
    And the plugins panel shows "git" configured "commit" as "manual"
    And the plugins panel shows "git" configured "push" as "off"
    And there should be no page errors

  Scenario: The selected namespace follows file precedence and deletion
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"identity-policy","ord":"a0","title":"identity","custom":{"login-header":"Remote-User"}}
      """
    And I open the plugins panel
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
    Then the plugins panel says "journal" is "_olai/Settings.olai says on: no"
    And there should be no page errors

  Scenario: A switch authors a durable namespace and links to it
    Given I open the app
    When I open the plugins panel
    Then the plugin "git" keeps defaults folded
    When I switch the plugin "journal" off
    Then the plugins panel says "journal" is "_olai/Settings.olai says on: no"
    And the plugins panel was started "Memory: LocalState"
    When I leave the app
    And the server stops
    And the server starts again on the same port
    And I open the app
    And I open the plugins panel
    Then the plugins panel says "journal" is "_olai/Settings.olai says on: no"
    And there should be no page errors

  Scenario: Authored chips name their source and the arrow opens the namespace
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"policy-target","ord":"a0","title":"git","custom":{"commit":"off"}}
      """
    And I open the plugins panel
    Then the plugins panel shows "git" configured "commit" as "off"
    And the plugin "git" marks "commit" as authored by "vault"
    And the plugins panel shows "git" configured "push" as "off"
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
