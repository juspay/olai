@scratch:good @git:repo
Feature: The git rows are the instance's policy, always read-only
  Committing and pushing are facts about a DIRECTORY, so both rows are the
  instance's: they draw its policy, the same in every browser, always read-only.
  There is no runtime door. A flag on the command line (or the nix module)
  names itself under the row; omitting it is the built-in default (`manual` /
  `off`). Never hidden: a policy a reader cannot see is one they cannot ask
  anybody about.

  So an operator may state one: `olai web --commit=auto --push=off`, or the
  same two as home-manager options (nix/home/module.nix). A flag that is GIVEN
  travels to every browser on the git cell and that row names it. Theme, font,
  size, notes and done are personal view choices, and there is nothing about
  them for a server to have an opinion on.

  Background:
    Given I open the outline "garden.olai"

  Scenario: A bare instance draws the built-in defaults, read-only
    When I open the preferences
    Then the "Git commit" row is the instance's built-in default
    And the "Git commit" row is set to "off"
    And the "Git commit" row cannot be changed from this browser
    And the "Git push" row is the instance's built-in default
    And the "Git push" row is set to "off"
    And the "Git push" row cannot be changed from this browser
    And there should be no page errors

  @pin:commit=auto @pin:push=off
  Scenario: A flagged instance names the flag, read-only
    When I open the preferences
    Then the "Git commit" row is the server's, set by "--commit=auto"
    And the "Git commit" row is set to "on"
    And the "Git commit" row cannot be changed from this browser
    And the "Git push" row is the server's, set by "--push=off"
    And the "Git push" row is set to "off"
    And the "Git push" row cannot be changed from this browser
    And there should be no page errors

  Scenario: The personal rows are untouched, and still move
    # The fence for a pin that spread. Theme, font, size, notes and done
    # are personal view choices — the reader's or the page's — and no server
    # has anything to say about them: they are live here exactly as they are
    # on an unpinned serve.
    When I open the preferences
    And I set Done to "visible"
    Then the Done row explains that finished work is "shown"
    And this browser has stored that done nodes are "shown" on "garden.olai"
    When I set Notes to "open"
    Then the Notes row explains that a row "already open"
    And there should be no page errors

  Scenario: The panel names the git rows as the instance's
    # Every other row on this panel really is stored here and sent nowhere, and
    # that sentence is the panel's own promise. The two git rows would otherwise
    # contradict it — they are the INSTANCE's — so the exception is named rather
    # than left to be noticed.
    When I open the preferences
    Then the panel says these preferences are this browser's
    And the preferences panel says two rows are the instance's
    And there should be no page errors

  @pin:commit=auto @pin:push=off
  Scenario: The flag is what the loop actually does, not only what it draws
    # THE FENCE FOR A FLAG HONOURED IN THE DRAWING AND NOT IN THE DOING. Nobody
    # has turned anything on in this browser and there is no control here that
    # could — and the flurry still records itself, because the loop the flag
    # armed is the server's and the row is drawing that same policy.
    Then this browser has stored nothing about git
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    Then the flurry records itself
    And olai has recorded 1 commit here
    # ... and --push=off is honoured too: the commit is made and stays here.
    And there should be no page errors

  @pin:commit=off
  Scenario: A pin of --commit=off says what it means, not "press the Commit button"
    # THE ONE ROW STATE THE OTHER TWO OFFS DO NOT COVER. Off is what `manual`
    # comes to as well, and there it is exactly true: a write waits for the
    # Commit button. Here the button is on an inert pill and olai never writes a
    # commit in this directory at all — so the shipped sentence would be this
    # row's permanent, reader-can-do-nothing statement pointing at a door that
    # will not open. The set-by line names which of the two Offs this is.
    When I open the preferences
    Then the "Git commit" row is the server's, set by "--commit=off"
    And the "Git commit" row is set to "off"
    And the Git commit row explains that a write "never touches git"
    And the Git commit row does not explain that a write "Commit button"
    And there should be no page errors
