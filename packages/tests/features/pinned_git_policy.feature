@scratch:good @git:repo @pin:commit=auto @pin:push=off
Feature: The server can pin the git policy, and the preferences say so
  Auto-commit and auto-push are preferences of one BROWSER, which is exactly
  right for one person on one machine and exactly wrong for a team. Whether a
  branch is pushed is not a thing one colleague's laptop gets to decide for
  everybody else, and "whichever browser happened to have the toggle on" is not
  a policy.

  So an operator may state one: `olai web --commit=auto --push=off`, or the
  same two as home-manager options (nix/home/module.nix). A flag that is GIVEN
  travels to every browser on the git cell — the channel that already carried
  `--no-commit` — and that preference row is drawn in the pinned state,
  read-only, naming the flag that set it. Never hidden, and never overridable
  from a browser: a policy a reader cannot see is one they cannot ask anybody
  about.

  What is NOT pinned is untouched, which is most of this panel: theme, font,
  size, notes, done and hidden outlines are personal view choices and there is
  nothing about them for a server to have an opinion on. And nothing about the
  browser's own stored pick is overwritten — this server says `--commit=auto`,
  and a reader who had auto-commit off keeps that in storage for the day the
  flag goes away.

  This feature's server is started `--commit=auto --push=off`. The unpinned
  case — every flag left alone, both rows live — is `preferences.feature` and
  `committing.feature`, which are the whole of what an unpinned deployment
  still promises.

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
    # The fence for a pin that spread. Theme, font, size, notes, done and
    # hidden outlines are claims about the READER, and no server has anything
    # to say about them — so they are live here exactly as they are on an
    # unpinned serve.
    When I open the preferences
    And I set Done to "hidden"
    Then the Done row explains that finished work is "hidden"
    And this browser has stored that done nodes are "hidden"
    When I set Notes to "open"
    Then the Notes row explains that a row "already open"
    And there should be no page errors

  Scenario: The panel names the pinned rows as the exception to "this browser's"
    # Every other row on this panel really is stored here and sent nowhere, and
    # that sentence is the panel's own promise. On a pinned serve it would
    # otherwise be contradicted by two rows a reader can see, so the exception
    # is named rather than left to be noticed.
    When I open the preferences
    Then the panel says these preferences are this browser's
    And the preferences panel says two rows are the server's
    And there should be no page errors

  Scenario: The pin is what the loop actually does, not only what it draws
    # THE FENCE FOR A PIN HONOURED IN THE DRAWING AND NOT IN THE LOOP. This
    # browser has never turned auto-commit on and there is no control here that
    # could — and the flurry still records itself, because the accessor the loop
    # reads is the one the row draws.
    Then this browser has never been asked about auto-commit
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    Then the flurry records itself
    And olai has recorded 1 commit here
    # ... and --push=off is honoured too: the commit is made and stays here.
    And there should be no page errors
