Feature: What git is doing is on screen, in ONE indicator
  Every write olai makes is a git commit, and for a while the only place that
  could go wrong was a boolean in a tool result and a line in the server's log.
  A person writing through the agent to a directory they knew was a repository
  got `committed: false` and a page that said nothing whatsoever — no repo, no
  git on the PATH, an identity nobody set and a healthy repository all looked
  identical from the browser. The ruling was that git stays non-blocking and
  becomes VISIBLE, which is what these scenarios hold.

  The fix then grew a second one. `● git` sat in the header beside `✓ committed
  · 3m ago`, and the human filed the screenshot: two chips answering "what is
  git doing here". They were already ONE derivation — both are renderings of a
  single survey the server runs, never two probes — so the readout retired into
  the Commit pill, and every state it drew is a face of that pill now. These
  scenarios are what came with it, together with the two the pill already had
  for the directories where nothing is ever recorded.

  What the pill can say when nobody is writing is the whole subject here: a
  serve told not to commit, a directory that is no work tree, a git that fails
  when it is asked, and a repository that is perfectly well. The first two are
  SETTINGS rather than faults — a directory of notes under a sync folder is not
  olai's business, and neither is a server somebody started with commits off —
  so they are dim and inert, with no warning. Saying nothing at all would be the
  failure this rule exists to prevent: the feature is an audit trail, "there is
  no audit trail here" is the most important thing it can report, and a control
  that disappeared is exactly how a person would never find that out.

  What each scenario's server was started into is its `@git:` tag — a
  repository, a directory that is not one, or a git that fails when it is asked
  — because the whole point is that the page knows before anybody writes
  anything. Those own their server (and their directory), so they are
  `@scratch:`; the serve with commits off needs neither, because the shared
  corpus server is already the serve it is about.

  Background:
    Given I open the outline "garden.olai"
    # The write some of these watch land is a DONE mark (`mint`), and the row
    # must stay drawn to be seen wearing it.
    And I show the done nodes

  Scenario: One pill answers for git, and a serve told not to commit says so
    # `--no-commit` is an owner's choice about a directory whose history is
    # somebody else's job. The readout drew NOTHING for it, which was right for
    # a chip whose only subject was git; it is wrong for the pill, whose subject
    # is the audit trail — "there is none here" is the thing to say, and it is
    # said dimly, as the setting it is.
    Then the header shows one git indicator
    And the commit pill says "off"
    And the commit pill reads "commits off"
    And the commit pill explains "commits are off for this server"
    And the commit pill is not alarming
    And the commit pill cannot be pressed
    And there should be no page errors

  @scratch:good @git:repo
  Scenario: A repository is reported, and quietly
    # The healthy default. It has to be legible and it must not shout: an
    # indicator that cries in the ordinary case is one nobody reads in the rare
    # one. Nothing has been written here yet, so what it reports is the fact a
    # count of what is pending cannot express.
    Then the header shows one git indicator
    And the commit pill says "never"
    And the commit pill reads "no commits yet"
    And the commit pill explains "this directory is a git repository"
    And the commit pill is not alarming
    And there should be no page errors

  @scratch:good @git:none
  Scenario: A directory that is no repository says so, calmly
    # Plenty of directories are not repositories, and being told so is not being
    # told off.
    Then the header shows one git indicator
    And the commit pill says "no-repo"
    And the commit pill reads "no git here"
    And the commit pill explains "not a git work tree"
    And the commit pill is not alarming
    And the commit pill cannot be pressed
    And there should be no page errors

  @scratch:good @git:broken
  Scenario: A git that fails says so, in git's own words
    # The state that used to be indistinguishable from the one above, and must
    # never collapse back into it: git ran, refused, and said why. What it said
    # is the answer a reader wants, so it is on the pill's own `aria-label` and
    # in the tip — never only in a log. It is the one face here that WARNS, and
    # the one a keyboard can still reach.
    Then the header shows one git indicator
    And the commit pill says "error"
    And the commit pill reads "git error"
    # The mark, positively. It is what a reader SCANS for, and a face that lost
    # its glyph would pass every other assertion on this scenario.
    And the commit pill is alarming
    And the commit pill explains "dubious ownership"
    When I hover the commit pill
    Then a tip says "git failed here, so writes are landing on disk but are not being committed — fatal: detected dubious ownership in repository"
    And there should be no page errors

  @scratch:good @git:broken
  Scenario: A write that could not be committed says why where the reader is looking
    # The other half of the bug, and the half the header cannot answer: the
    # write LANDED — that is the guarantee — and the reply says why it is not in
    # the history, in git's own words, in the block a reader opens on the call
    # that made it. The whole path is real here: panel, ops, git, and the tool
    # result coming back.
    Given the agent panel is open
    When I ask the agent "done mint"
    Then the chat shows a completed tool call
    And node "mint" is done
    When I unfold the tool call
    Then the tool call's detail says "dubious ownership"
