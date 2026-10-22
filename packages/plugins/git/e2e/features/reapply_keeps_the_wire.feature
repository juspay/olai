@scratch:good @git:repo
Feature: Changing git's policy keeps the tab connected

  `commit` is a plain config leaf, not `configUpdates: "live"`: the serve
  restarts the git row to apply a new value, drops its surface sibling and
  mounts a fresh one. The tab follows that mount — it redials, and every
  standing subscription to `git/git` and `git/pending` re-opens on the new
  wire. Before the roster carried a per-row mount generation, the frame looked
  unchanged, the tab kept its old subscriptions, and git's readout fell to its
  off face while the health dot said Partly connected.

  Scenario: Auto, manual and auto again from the Preferences
    Given I open the app
    # EACH PICK WRITES `_olai/Settings.olai`, so the repository has one
    # uncommitted change while the Commit row is on screen. That is the point:
    # counting it proves the tab's `pending` subscription re-opened after the
    # server restarted the row, and committing it clears the amber that would
    # otherwise say nothing about the connection.
    When I open the preferences
    And I pick "auto" in the preference "plugin-git-commit"
    Then the preference "plugin-git-commit" shows "auto"
    And the connection is "live"
    And the commit pill says 1 uncommitted
    And the commit pill is live
    When I press Escape on the preferences
    And I open the commit panel
    And I commit with the message "the auto policy"
    Then the commit pill says "committed"
    And the health dot is "healthy"

    When I open the preferences
    And I pick "manual" in the preference "plugin-git-commit"
    Then the preference "plugin-git-commit" shows "manual"
    And the connection is "live"
    And the commit pill says 1 uncommitted
    And the commit pill is live
    When I press Escape on the preferences
    And I open the commit panel
    And I commit with the message "the manual policy"
    Then the commit pill says "committed"
    And the health dot is "healthy"

    When I open the preferences
    And I pick "auto" in the preference "plugin-git-commit"
    Then the preference "plugin-git-commit" shows "auto"
    And the connection is "live"
    And the commit pill says 1 uncommitted
    And the commit pill is live
    When I press Escape on the preferences
    And I open the commit panel
    And I commit with the message "the auto policy again"
    Then the commit pill says "committed"
    And the health dot is "healthy"
    And there should be no page errors
