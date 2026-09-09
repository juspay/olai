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
    Then the plugins panel shows "git" configured "commit" as "manual"
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
