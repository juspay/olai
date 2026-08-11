@scratch:good @git
Feature: Committing on purpose
  Every write olai makes is a write nobody typed — the chat agent auto-approves
  its ops, and an agent in a terminal is working on its own — so git is how you
  see what the tool did to your files. That is the one job: an audit trail.

  It used to happen on every write, which turned one train of thought into a
  dozen commits. Now the writes land on disk and WAIT, and something asks: a
  button here, and a `commit` tool for the agent.

  The pill is ALWAYS on screen, in whichever of its six states this directory
  is in. That follows from what it is for: if the job is to be an audit trail,
  "there is no audit trail here" is the most important thing it can say, and a
  control that disappeared is exactly how a person would never find that out.
  So every scenario below asserts which FACE it is wearing, never whether it is
  there.

  These are the only scenarios served out of a git repository (`@git`), because
  what is waiting is DERIVED from git rather than counted — there is nothing to
  test without one, and the assertions at the end are lines out of its log.

  Background:
    Given I open the outline "garden.jsonl"

  Scenario: A directory olai has never committed in says exactly that
    # Not "committed", which would be a lie, and not nothing at all. A clean
    # tree that just committed and one where olai has never written are the
    # same count of pending changes and different facts.
    Then the commit pill says "never"
    When I open the commit panel
    Then the panel says the last commit was "not committed in this directory yet"
    And there should be no page errors

  Scenario: An edit waits, is shown as what it is, and is committed on purpose
    When I rewrite "garden.jsonl" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","done":"2026-08-10"}
      """
    Then the commit pill says "waiting"
    And the commit pill says 1 uncommitted
    When I open the commit panel
    # Never a text diff: a `.jsonl` diff is one enormous line per node with
    # everything on it changing at once. The unit is the node and what changed
    # about it.
    Then the change to "mint" is "done"
    When I commit with the message "the mint is split"
    # ... and now both halves of the question have an answer: nothing is
    # waiting, and something was recorded.
    Then the commit pill says "committed"
    And the last commit is "olai: the mint is split" by "web"
    And the repository is clean
    When I open the commit panel
    Then the panel says the last commit was "the mint is split"
    And the panel says the last commit was "you"
    And there should be no page errors

  Scenario: A repository that cannot take a commit says so instead of doing nothing
    # The hole this whole feature closed: nothing used to check, so an agent
    # marking a node done mid-rebase could swallow a resolution.
    When HEAD is detached in the served repository
    And I rewrite "garden.jsonl" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true,"desc":"the roots are matted"}
      """
    Then the commit pill says "blocked"
    And the commit pill says 1 uncommitted
    When I open the commit panel
    Then the panel says the repository is "detached"
    And the commit button is disabled
    And there should be no page errors
