@scratch:good @git
Feature: Committing on purpose
  Every write olai makes is a write nobody typed — the chat agent auto-approves
  its ops, and an agent in a terminal is working on its own — so git is how you
  see what the tool did to your files. That is the one job: an audit trail.

  It used to happen on every write, which turned one train of thought into a
  dozen commits. Now the writes land on disk and WAIT, and something asks: a
  button here, and a `commit` tool for the agent.

  These are the only scenarios served out of a git repository (`@git`), because
  what is waiting is DERIVED from git rather than counted — there is nothing to
  test without one, and the assertions at the end are lines out of its log.

  Background:
    Given I open the outline "garden.jsonl"

  Scenario: A clean directory says nothing at all
    # Nothing pending, nothing shown. A control that were always there would be
    # a permanent nag about a directory that is usually clean.
    Then there is nothing to commit

  Scenario: An edit waits, is shown as what it is, and is committed on purpose
    When I rewrite "garden.jsonl" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","done":"2026-08-10"}
      """
    Then the commit pill says 1 uncommitted
    When I open the commit panel
    # Never a text diff: a `.jsonl` diff is one enormous line per node with
    # everything on it changing at once. The unit is the node and what changed
    # about it.
    Then the change to "mint" is "done"
    When I commit with the message "the mint is split"
    Then there is nothing to commit
    And the last commit is "olai: the mint is split" by "web"
    And the repository is clean
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
    Then the commit pill says 1 uncommitted
    When I open the commit panel
    Then the panel says the repository is "detached"
    And the commit button is disabled
    And there should be no page errors
