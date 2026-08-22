@scratch:good @git:repo @pin:commit=auto @pin:push=auto
Feature: A pinned loop that git stopped can still be started again
  A commit or a push git REFUSED pauses Auto-commit and nothing clears that on
  olai's own initiative: a loop that un-paused itself is a blind retry wearing a
  different hat, and piling more automatic commits onto a branch that has
  already diverged makes the eventual resolution worse. So it waits for a person
  to say they have dealt with whatever git said.

  Where the Git commit row is this browser's, that gesture is turning it off and
  on again — `committing.feature`'s divergence scenario is the whole of it. On a
  server that PINNED the policy there is no toggle to flip, so the same stop
  would be permanent and silent, which is the one failure a loop nobody watches
  may not have. The frozen row carries a **Resume** button instead: the same
  gesture, on the only control a pinned row is allowed to have.

  This server is started `--commit=auto --push=auto`, and the divergence is the
  case that meets it — somebody else has pushed, so the push is a
  non-fast-forward. Nothing here pulls, rebases or forces.

  Background:
    Given I open the outline "garden.olai"
    And the served repository has a remote

  Scenario: A branch somebody else moved stops the pinned loop, and Resume starts it again
    Given somebody else has pushed to the remote
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    Then the flurry records itself
    And olai has recorded 1 commit here
    And the commit pill says auto-commit is "paused"
    # Git's own words, on the sentence a reader with no pointer gets.
    And the commit pill explains "rejected"
    # ... and the gesture named is the one this reader ACTUALLY HAS. A frozen
    # row has no toggle, so a sentence still naming the off-and-on dance would
    # send somebody after a control that is on screen and inert.
    And the commit pill explains "Resume"
    When I open the preferences
    Then the "Git commit" row is the server's, set by "--commit=auto"
    And the preferences offer to resume auto-commit
    When I resume auto-commit
    Then the commit pill says auto-commit is "armed"
    And the preferences do not offer to resume auto-commit
    And there should be no page errors

  Scenario: A running loop is offered no Resume, because there is nothing to resume
    # A control with nothing to do is a control that teaches a reader to ignore
    # it — which is exactly the wrong lesson for the one button that undoes a
    # silent stop.
    When I open the preferences
    Then the "Git commit" row is the server's, set by "--commit=auto"
    And the preferences do not offer to resume auto-commit
    And there should be no page errors
