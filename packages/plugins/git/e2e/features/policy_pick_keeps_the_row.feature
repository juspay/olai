@scratch:good @git:repo
Feature: A git policy pick keeps the row, its panel and its state

  `commit` and `push` declare `configUpdates: "live"`: the serve applies a pick
  to the running ledger rather than mounting a fresh sibling. The row keeps its
  fiber, its cells, the pause or refusal it remembers and any open Commit
  panel. The one thing a pick owes in place of a restart is `push: off → auto`:
  the commits already recorded here are sent once.

  Scenario: Auto, manual and auto again from the Preferences
    Given I open the app
    When I open the preferences
    And I pick "auto" in the preference "plugin-git-commit"
    Then the preference "plugin-git-commit" shows "auto"
    And the connection is "live"
    And the commit pill is live
    And the flurry records itself
    And the health dot is "healthy"

    When I pick "manual" in the preference "plugin-git-commit"
    Then the preference "plugin-git-commit" shows "manual"
    And the connection is "live"
    And the commit pill is live
    And the commit pill says 1 uncommitted
    When I press Escape on the preferences
    And I open the commit panel
    And I commit with the message "the manual policy"
    Then the commit pill says "committed"
    And the health dot is "healthy"

    When I open the preferences
    And I pick "auto" in the preference "plugin-git-commit"
    Then the preference "plugin-git-commit" shows "auto"
    And the connection is "live"
    And the commit pill is live
    And the flurry records itself
    And the health dot is "healthy"
    And there should be no page errors

  Scenario: A pick in another tab leaves this tab's Commit panel open
    Given I open the app
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    Then the commit pill says 1 uncommitted
    When I open the commit panel
    And I draft the commit message "the panel outlives the pick"
    And I open another browser tab
    And I open the preferences
    And I pick "auto" in the preference "plugin-git-commit"
    And I use the original browser tab
    Then the commit panel is open
    And the commit message still reads "the panel outlives the pick"
    And the commit pill is live
    And the flurry records itself
    And there should be no page errors

  Scenario: Picking push auto sends the commits already recorded here
    Given I open the app
    And the served repository has a remote
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    And I open the commit panel
    And I commit with the message "the herb bed needs splitting"
    Then the commit pill says 1 unpushed
    When I open the preferences
    And I pick "auto" in the preference "plugin-git-push"
    Then the commit pill says 0 unpushed
    And the remote has "olai: the herb bed needs splitting"
    And there should be no page errors
