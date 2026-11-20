@scratch:good @git:repo
Feature: Committing on purpose
  Every write olai makes is a write nobody typed — the chat agent auto-approves
  its ops, and an agent in a terminal is working on its own — so git is how you
  see what the tool did to your files. That is the one job: an audit trail.

  It used to happen on every write, which turned one train of thought into a
  dozen commits. Now the writes land on disk and WAIT, and something asks: a
  button here, a `commit` tool for the agent — and, when this browser asks for
  it, the quiet window at the end of a flurry. Auto-commit is the third door
  and deliberately not a fourth committer: it presses the same verb the button
  does, once the edits have stopped arriving, so a burst of work is ONE commit
  and never one per op.

  The pill is ALWAYS on screen, in whichever of its six states this directory
  is in. That follows from what it is for: if the job is to be an audit trail,
  "there is no audit trail here" is the most important thing it can say, and a
  control that disappeared is exactly how a person would never find that out.
  So every scenario below asserts which FACE it is wearing, never whether it is
  there.

  These are the only scenarios served out of a git repository (`@git:repo`), because
  what is waiting is DERIVED from git rather than counted — there is nothing to
  test without one, and the assertions at the end are lines out of its log.

  Background:
    Given I open the outline "garden.olai"

  Scenario: A directory olai has never committed in says exactly that
    Then the commit pill says "never"
    When I open the commit panel
    Then the panel says the last commit was "olai hasn't committed in this folder yet"
    And there should be no page errors

  Scenario: Pressing the pill again puts the panel away
    When I open the commit panel
    And I press the commit pill
    Then the commit panel is shut

  Scenario: An edit waits, is shown as what it is, and is committed on purpose
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door","doing":"2026-07-20"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","done":"2026-08-10"}
      {"id":"frames","parent":"garden","ord":"a1","title":"the cold frames"}
      {"id":"glazing","parent":"frames","ord":"a0","title":"replace the cracked pane","done":"2026-07-15"}
      {"id":"sowing","parent":"frames","ord":"a1","title":"sow the first trays","done":"2026-08-11"}
      {"id":"slugs","parent":"frames","ord":"a2","title":"the slugs got the seedlings last year"}
      {"id":"compost","parent":"garden","ord":"a2","title":"the compost heap"}
      {"id":"turned","parent":"compost","ord":"a0","title":"turn the pile","done":"2026-07-01"}
      {"id":"straw","parent":"compost","ord":"a1","title":"add the straw","done":"2026-07-02"}
      """
    Then the commit pill says "waiting"
    And the commit pill says 1 uncommitted
    When I open the commit panel
    Then the change to "mint" is "done"
    When I commit with the message "the mint is split"
    Then the commit pill says "committed"
    And the last commit is "olai: the mint is split" by "web"
    And the repository is clean
    When I open the commit panel
    Then the panel says the last commit was "the mint is split"
    And the panel says the last commit was "you"
    And there should be no page errors

  Scenario: A document edited by hand is waiting too, and can be committed on its own
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    And I rewrite "later.md" as:
      """
      not this time
      """
    Then the commit pill says "waiting"
    And the commit pill says 2 uncommitted
    When I open the commit panel
    Then the panel lists "notes.md" as "untracked"
    And the panel lists "later.md" as "untracked"
    And the panel says it covers the whole repository
    When I untick "later.md"
    Then the commit button offers "Commit 1 file"
    When I commit with the message "the herb bed needs splitting"
    Then the commit pill says 1 uncommitted
    And the last commit is "olai: the herb bed needs splitting" by "web"
    And the last commit touched exactly "notes.md"
    And "later.md" is still waiting in the repository
    And there should be no page errors

  Scenario: What is recorded and not shared says so, in the header and in the panel
    Given the served repository has a remote
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    And I open the commit panel
    And I commit with the message "the herb bed needs splitting"
    Then the commit pill says 1 unpushed
    When I open the commit panel
    Then the panel offers to push 1 commits
    When I push
    Then the commit pill says 0 unpushed
    And the remote has "olai: the herb bed needs splitting"
    And there should be no page errors

  @policy:git.push=auto
  Scenario: A commit is pushed when the directory's push policy is Auto-push
    Given the served repository has a remote
    Then this browser has stored nothing about git
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    And I open the commit panel
    And I commit with the message "the herb bed needs splitting"
    Then the commit pill says "committed"
    And the last commit is "olai: the herb bed needs splitting" by "web"
    And the commit pill says 0 unpushed
    And the remote has "olai: the herb bed needs splitting"
    And there should be no page errors

  Scenario: A repository that cannot take a commit says so instead of doing nothing
    When HEAD is detached in the served repository
    And I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door","doing":"2026-07-20"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true,"desc":"the roots are matted"}
      {"id":"frames","parent":"garden","ord":"a1","title":"the cold frames"}
      {"id":"glazing","parent":"frames","ord":"a0","title":"replace the cracked pane","done":"2026-07-15"}
      {"id":"sowing","parent":"frames","ord":"a1","title":"sow the first trays","done":"2026-08-11"}
      {"id":"slugs","parent":"frames","ord":"a2","title":"the slugs got the seedlings last year"}
      {"id":"compost","parent":"garden","ord":"a2","title":"the compost heap"}
      {"id":"turned","parent":"compost","ord":"a0","title":"turn the pile","done":"2026-07-01"}
      {"id":"straw","parent":"compost","ord":"a1","title":"add the straw","done":"2026-07-02"}
      """
    Then the commit pill says "blocked"
    And the commit pill says 1 uncommitted
    And the health dot is "notice"
    And the health dot names "1 uncommitted"
    When I open the commit panel
    Then the panel says the repository is "No branch is checked out"
    And the commit button is disabled
    And there should be no page errors

  Scenario: A stale lock file is removed from the panel, and the commit lands
    Given a stale lock file sits in the repository
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    And I open the commit panel
    And I commit with the message "the herb bed needs splitting"
    Then the commit panel says a lock file is in the way
    And the commit pill says "error"
    And the commit panel offers to remove the lock file
    When I remove the lock file and retry
    Then the commit pill says "committed"
    And the last commit is "olai: the herb bed needs splitting" by "web"
    And the repository is clean
    And the commit panel does not offer to remove a lock file
    And there should be no page errors

  Scenario: A lock a git process may still be writing is not removed
    Given a stale lock file sits in the repository
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    And I open the commit panel
    And I commit with the message "the herb bed needs splitting"
    Then the commit panel says a lock file is in the way
    And the commit panel says the lock was left "10m ago"
    Given a fresh lock file sits in the repository
    When I remove the lock file and retry
    Then the commit panel says the lock was left "just now"
    And the panel says a git process may still be writing
    And the commit panel offers to remove the lock file
    And there should be no page errors

  Scenario: A lock file that cannot be removed says why, and the press can be repeated
    Given a stale lock file sits in the repository
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    And I open the commit panel
    And I commit with the message "the herb bed needs splitting"
    Then the commit panel says a lock file is in the way
    Given the git directory cannot be written to
    When I remove the lock file and retry
    Then the panel says the lock could not be removed
    And the commit panel offers to remove the lock file
    When the git directory can be written to again
    And I remove the lock file and retry
    Then the commit pill says "committed"
    And the last commit is "olai: the herb bed needs splitting" by "web"
    And the repository is clean
    And there should be no page errors

  @policy:git.commit=auto
  Scenario: A stale lock pauses auto-commit, and one press starts the loop again
    Given a stale lock file sits in the repository
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    When the quiet window is given its full run
    Then the commit pill says auto-commit is "paused"
    And the commit pill says 1 uncommitted
    When I open the commit panel
    Then the commit panel offers to remove the lock file
    When I remove the lock file and retry
    Then the commit pill says auto-commit is "armed"
    And the last commit is "olai: 1 file — notes.md" by "web"
    When I rewrite "later.md" as:
      """
      and the frames want glazing
      """
    Then the commit pill says 1 uncommitted
    And the flurry records itself
    And olai has recorded 2 commits here
    And the last commit is "olai: 1 file — later.md" by "auto"
    And the repository is clean
    And there should be no page errors

  @policy:git.commit=auto @policy:git.push=auto
  Scenario: A flurry of edits records itself as one commit, and is pushed
    Given the served repository has a remote
    Then this browser has stored nothing about git
    And the commit pill says auto-commit is "armed"
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door","doing":"2026-07-20"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","done":"2026-08-10"}
      {"id":"frames","parent":"garden","ord":"a1","title":"the cold frames"}
      {"id":"glazing","parent":"frames","ord":"a0","title":"replace the cracked pane","done":"2026-07-15"}
      {"id":"sowing","parent":"frames","ord":"a1","title":"sow the first trays","done":"2026-08-11"}
      {"id":"slugs","parent":"frames","ord":"a2","title":"the slugs got the seedlings last year"}
      {"id":"compost","parent":"garden","ord":"a2","title":"the compost heap"}
      {"id":"turned","parent":"compost","ord":"a0","title":"turn the pile","done":"2026-07-01"}
      {"id":"straw","parent":"compost","ord":"a1","title":"add the straw","done":"2026-07-02"}
      """
    And I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    And I rewrite "later.md" as:
      """
      and the frames want glazing
      """
    Then the commit pill says "waiting"
    When I open the commit panel
    Then the panel promises to record it on its own
    When I press the commit pill
    Then the commit panel is shut
    Then the flurry records itself
    And olai has recorded 1 commit here
    And the repository is clean
    And the commit pill says 0 unpushed
    When I open the commit panel
    Then the panel promises nothing
    And there should be no page errors

  @policy:git.commit=auto
  Scenario: The window alone records, and the commits wait to be pushed
    Given the served repository has a remote
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    Then the flurry records itself
    And olai has recorded 1 commit here
    And the commit pill says 1 unpushed
    And there should be no page errors

  @policy:git.commit=auto @policy:git.push=auto
  Scenario: A branch somebody else has moved is taken in, and the push lands
    Given the served repository has a remote
    And somebody else has pushed "theirs" to the remote
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    Then the flurry records itself
    And olai has recorded 1 commit here
    And the commit pill says auto-commit is "armed"
    And the commit pill says 0 unpushed
    And the remote has "olai: 1 file — notes.md"
    And the remote has taken in "theirs" before this commit
    And the served directory has "their-file.md"
    And there should be no page errors

  @policy:git.commit=auto @policy:git.push=auto
  Scenario: A conflicting take-in stops the loop, and says so
    Given the served repository has a remote
    And somebody else has pushed a conflicting edit to "finishes.md"
    When I rewrite "finishes.md" as:
      """
      the herb bed needs splitting again
      """
    Then the flurry records itself
    And olai has recorded 1 commit here
    And the commit pill says auto-commit is "paused"
    And the commit pill explains "CONFLICT"
    And the commit pill says the push was refused
    And the commit pill reads "Push refused"
    And the commit pill is alarming
    And the health dot is "alarm"
    And the health dot names "Push refused"
    When I open the commit panel
    Then the panel says auto-commit is paused
    And the panel says a push was refused
    When I press the commit pill
    And I rewrite "later.md" as:
      """
      and the frames want glazing
      """
    Then the commit pill says 1 uncommitted
    When the quiet window is given its full run
    Then olai has recorded 1 commit here
    And "later.md" is still waiting in the repository
    And the commit pill says auto-commit is "paused"
    And there should be no page errors
    When I open the commit panel
    Then the commit panel offers to resume auto-commit
    When I resume auto-commit
    Then the commit pill says auto-commit is "armed"
    And there should be no page errors

  @policy:git.commit=auto @policy:git.push=auto
  Scenario: A reload does not clear a stop, and Resume in any tab does
    Given the served repository has a remote
    And somebody else has pushed a conflicting edit to "finishes.md"
    When I rewrite "finishes.md" as:
      """
      the herb bed needs splitting again
      """
    Then the flurry records itself
    And the commit pill says auto-commit is "paused"
    When I reload the page
    Then the commit pill says auto-commit is "paused"
    And the commit pill says the push was refused
    When I open the commit panel
    Then the commit panel offers to resume auto-commit
    When I resume auto-commit
    Then the commit pill says auto-commit is "armed"
    And there should be no page errors

  @policy:git.commit=manual @policy:git.push=auto
  Scenario: An edit you have not committed in a path somebody else changed waits for its commit
    Given the served repository has a remote
    And somebody else has rewritten "their-file.md" as:
      """
      theirs
      """
    And I rewrite "their-file.md" as:
      """
      theirs
      """
    And I rewrite "another.md" as:
      """
      the frames want glazing
      """
    And I open the commit panel
    And I untick "their-file.md"
    And I commit with the message "the other file"
    And the commit pill says the push was refused
    Then the commit pill explains "commit what is yours first"
    And the commit pill says 1 unpushed
    And I commit with the message "the overlapping file"
    Then the commit pill says 0 unpushed
    And the remote has "olai: the other file"
    And the served directory has "their-file.md"
    And there should be no page errors
