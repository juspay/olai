@scratch:good @git:repo
Feature: A prepared commit survives a neighboring plugin rebuild
  Background:
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I select all and type "prepared handles"
    And I press "Enter"
    Then the commit pill says 1 uncommitted

  Scenario: The prepared message and excluded file both survive rebuilding
    When I rewrite "separate.md" as:
      """
      Work for a separate commit
      """
    Then the commit pill says 2 uncommitted
    When I open the commit panel
    And I untick "separate.md"
    And I draft the commit message "only the outline work"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    When I open the commit panel
    Then the commit message still reads "only the outline work"
    And the commit ledger includes the settings switch
    When I submit the drafted commit
    Then the commit pill says 1 uncommitted
    And the last commit is "olai: only the outline work" by "web"
    And the last commit touched exactly "_olai/Settings.olai, house.olai"
    When I open the commit panel
    Then the commit button offers "Commit 1 file"
    When I commit with the message "the remaining work"
    Then the commit pill says "committed"
    And the last commit touched exactly "separate.md"
    And the repository is clean
    And there should be no page errors

  @policy:git.commit=auto
  Scenario: A prepared message survives a policy pick, which restarts the row
    # The pick is a POLICY CHANGE, so the server restarts git's fiber and the
    # tab restarts this row's browser half (`reapply_keeps_the_wire`). The
    # panel belongs to that half; the message does not — it lives in the
    # module-scope preparation (`browser/commit/preparation.ts`), which is what
    # lets a person reopen the panel after the change and keep typing.
    When I open the commit panel
    And I draft the commit message "survives the policy pick"
    And I press the commit pill
    Then the commit panel is shut
    When I open the preferences
    And I pick "manual" in the preference "plugin-git-commit"
    Then the connection is "live"
    And the commit pill is live
    When I press Escape on the preferences
    And I open the commit panel
    Then the commit message still reads "survives the policy pick"
    And there should be no page errors

  Scenario: Closing the panel to review the outline keeps the prepared message
    When I open the commit panel
    And I draft the commit message "reviewed before recording"
    And I press the commit pill
    Then the commit panel is shut
    And the node "handles" has the title "prepared handles"
    When I open the commit panel
    Then the commit message still reads "reviewed before recording"
    When I submit the drafted commit
    Then the commit pill says "committed"
    And the last commit is "olai: reviewed before recording" by "web"
    And the repository is clean
    And there should be no page errors
