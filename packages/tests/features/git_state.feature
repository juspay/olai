Feature: What git is doing is on screen
  Every write olai makes is a git commit, and for a while the only place that
  could go wrong was a boolean in a tool result and a line in the server's log.
  A person writing through the agent to a directory they knew was a repository
  got `committed: false` and a page that said nothing whatsoever — no repo, no
  git on the PATH, an identity nobody set and a healthy repository all looked
  identical from the browser. The ruling was that git stays non-blocking and
  becomes VISIBLE, which is what these scenarios hold.

  The readout lives in the app header beside the connection, because they are
  the same shape of promise about the same page: that it is still reading, and
  that what is written to it is being kept. What each scenario's server was
  started into is its `@git:` tag — a repository, a directory that is not one,
  or a git that fails when it is asked — because the whole point is that the
  page knows before anybody writes anything. Those three own their server (and
  their directory), so they are `@scratch:`; the first needs neither, because
  the shared corpus server is already the serve it is about.

  Background:
    Given I open the outline "garden.jsonl"

  Scenario: A serve that was told not to commit says nothing about git
    # `--no-commit` is an owner's choice about a directory whose history is
    # somebody else's job, and chrome reporting a SETTING is chrome a reader
    # learns to skip — which is the opposite of what the other three want.
    Then there is no git readout

  @scratch:good @git:repo
  Scenario: A repository is reported, and quietly
    # The healthy default. It has to be legible and it must not shout: an
    # indicator that cries in the ordinary case is one nobody reads in the rare
    # one.
    Then the git readout says "repo"
    And the git readout reads "git"
    And the git readout explains "every write is committed"

  @scratch:good @git:none
  Scenario: A directory that is no repository says so, calmly
    Then the git readout says "none"
    And the git readout reads "Not a Git repo"
    And the git readout explains "not a git work tree"

  @scratch:good @git:broken
  Scenario: A git that fails says so, in git's own words
    # The state that used to be indistinguishable from the one above: git ran,
    # refused, and said why. What it said is the answer a reader wants, so it is
    # on the readout's own label and in the tip — never only in a log.
    Then the git readout says "error"
    And the git readout reads "Git error"
    And the git readout explains "dubious ownership"
    When I hover the git readout
    Then a tip says "git failed here, so writes are landing on disk but are not being committed — fatal: detected dubious ownership in repository"
    And there should be no page errors
