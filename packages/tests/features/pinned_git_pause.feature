@scratch:good @git:repo @pin:commit=auto @pin:push=auto
Feature: A pinned loop that git stopped can still be started again
  A commit or a push git REFUSED pauses the quiet window and nothing clears that
  on olai's own initiative: a loop that un-paused itself is a blind retry
  wearing a different hat, and piling more automatic commits onto a branch that
  has already diverged makes the eventual resolution worse. So it waits for a
  person to say they have dealt with whatever git said.

  There is ONE gesture for that and it is **Resume**, on every deployment. It
  used to be two: the stop lived in a browser tab, so turning that browser's own
  Auto-commit toggle off and on again cleared it, and only a PINNED row — which
  has no toggle to flip — carried a button. The stop is a fact about the
  DIRECTORY now, so no toggle and no reload can clear it, and Resume is a server
  procedure that clears it for every reader at once.

  What this feature still holds that `committing.feature` cannot is that the
  gesture survives the row being READ-ONLY: an operator who pinned the policy
  has taken the toggle away, and the one control a stopped loop needs must not
  go with it.

  This server is started `--commit=auto --push=auto`, and the divergence is the
  case that meets it — somebody else has pushed, so the push is a
  non-fast-forward. Nothing here pulls, rebases or forces.

  Background:
    Given I open the outline "garden.org"
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
    # ... and the gesture named is the one that exists: a frozen row has no
    # toggle, and neither does an unfrozen one any more.
    And the commit pill explains "Resume"
    When I open the preferences
    Then the "Git commit" row is the server's, set by "--commit=auto"
    And the "Git commit" row cannot be changed from this browser
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
