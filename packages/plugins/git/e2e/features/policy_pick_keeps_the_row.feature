@scratch:good @git:repo
Feature: A git policy pick keeps the row, its panel and its state

  `commit` and `push` declare `configUpdates: "live"`: the serve applies a pick
  to the running ledger rather than mounting a fresh sibling. The row keeps its
  fiber, its cells, the pause or refusal it remembers and any open Commit
  panel. The one thing a pick owes in place of a restart is `push: off → auto`:
  the commits already recorded here are sent once.

  Scenario: Auto, manual and auto again from the Preferences
    Given I open the app
    # EACH PICK WRITES `_olai/Settings.olai`. Under `auto` that pending write
    # arms the 15 s quiet window, so the AUTO segments wait for the loop to
    # record it instead of racing a manual commit against the timer. The
    # `manual` segment has no timer and commits by hand.
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
    # A restart would have taken the browser half with it and shut this panel.
    # The panel belongs to the activation now, so the pick arrives beside it.
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
    # A read of the pill opens the health popover, and that press is a
    # click-away for any panel beside it — so the assertion above is the claim
    # that the PICK left the panel standing, before anything deliberately
    # opens another one.
    And the commit pill is live
    # ...and the loop the pick chose is already running: the settings write and
    # the notes edit are one flurry, recorded without a redial.
    And the flurry records itself
    And there should be no page errors

  Scenario: Picking push auto sends the commits already recorded here
    # `catchUp` ran once at activation and returned because pushing was off, so
    # a live pick owes the push a restart used to provide: the commits already
    # here go out when the policy becomes auto.
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
    # No restart: the catch-up runs on the row already standing, and the pill's
    # live cell is what says the push finished.
    Then the commit pill says 0 unpushed
    And the remote has "olai: the herb bed needs splitting"
    And there should be no page errors
