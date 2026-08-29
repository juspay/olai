@scratch:good @git:repo @pin:commit=auto @pin:push=off
Feature: The server can pin the git policy, and the preferences say so
  Committing and pushing are facts about a DIRECTORY, so both rows are the
  server's: they set its policy for this directory and draw its answer, and
  every browser looking at it reads the same one. What a PIN adds is that a
  flag on the command line takes the row away from readers entirely — whether a
  branch is pushed is not a thing one colleague's laptop gets to decide for
  everybody else, and on a shared instance it is not a thing they get to decide
  from a preferences panel either.

  So an operator may state one: `olai web --commit=auto --push=off`, or the
  same two as home-manager options (nix/home/module.nix). A flag that is GIVEN
  travels to every browser on the git cell — the channel that already carried
  `--no-commit` — and that row is drawn in the pinned state, read-only, naming
  the flag that set it. Never hidden, and never overridable from a browser: a
  policy a reader cannot see is one they cannot ask anybody about.

  What is NOT pinned is untouched, which is most of this panel: theme, font,
  size, notes and done are personal view choices, and there is nothing
  about them for a server to have an opinion on.

  This feature's server is started `--commit=auto --push=off`. The unpinned
  case — every flag left alone, both rows live and both setting the server's
  own policy — is `preferences.feature` and `committing.feature`, which are the
  whole of what an unpinned deployment still promises.

  Background:
    Given I open the outline "garden.olai"

  Scenario: A pinned row is drawn in the server's state, read-only, naming the flag
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
    # are claims about the READER, and no server has anything
    # to say about them — so they are live here exactly as they are on an
    # unpinned serve.
    When I open the preferences
    And I set Done to "hidden"
    Then the Done row explains that finished work is "hidden"
    And this browser has stored that done nodes are "hidden"
    When I set Notes to "open"
    Then the Notes row explains that a row "already open"
    And there should be no page errors

  Scenario: The panel names the git rows as the exception to "this browser's"
    # Every other row on this panel really is stored here and sent nowhere, and
    # that sentence is the panel's own promise. The two git rows would otherwise
    # contradict it — they are the DIRECTORY's, remembered on the server — so
    # the exception is named rather than left to be noticed, and a pinned serve
    # says the further thing about them: they are read-only here.
    When I open the preferences
    Then the panel says these preferences are this browser's
    And the preferences panel says two rows are the server's
    And there should be no page errors

  Scenario: The pin is what the loop actually does, not only what it draws
    # THE FENCE FOR A PIN HONOURED IN THE DRAWING AND NOT IN THE DOING. Nobody
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
    #
    # Its own @pin: tag beside the feature's, which the later tag wins.
    When I open the preferences
    Then the "Git commit" row is the server's, set by "--commit=off"
    And the "Git commit" row is set to "off"
    And the Git commit row explains that a write "never touches git"
    And the Git commit row does not explain that a write "Commit button"
    And there should be no page errors
