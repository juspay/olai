@scratch:good @git:repo
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

  These are the only scenarios served out of a git repository (`@git:repo`), because
  what is waiting is DERIVED from git rather than counted — there is nothing to
  test without one, and the assertions at the end are lines out of its log.

  Background:
    Given I open the outline "garden.olai"

  Scenario: A directory olai has never committed in says exactly that
    # Not "committed", which would be a lie, and not nothing at all. A clean
    # tree that just committed and one where olai has never written are the
    # same count of pending changes and different facts.
    Then the commit pill says "never"
    When I open the commit panel
    Then the panel says the last commit was "not committed in this directory yet"
    And there should be no page errors

  Scenario: Pressing the pill again puts the panel away
    # TWO ROOTS, one bug. The pill and the panel are siblings — the panel is
    # portalled out of the header — so a click-away that knows only the panel
    # reads a press of the PILL as a press outside, shuts on the pointerdown,
    # and is reopened a moment later by that same press's click. Pressing it a
    # second time did nothing at all, and nothing could see it: the panel was
    # open before and open after. The two popovers in this bar share their open
    # state now (`web/src/client/popover.ts`), and this is its fence.
    When I open the commit panel
    And I press the commit pill
    Then the commit panel is shut

  Scenario: An edit waits, is shown as what it is, and is committed on purpose
    # The whole corpus file, with ONE node changed: `mint` goes from under way
    # to done. Written out in full because the count below is the point — a
    # rewrite that dropped the nodes it was not about would report those as
    # gone, which is true and not what this scenario is asking.
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
    # Never a text diff: a `.olai` diff is one enormous line per node with
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

  Scenario: A document edited by hand is waiting too, and can be committed on its own
    # The bug this whole item was filed for, in the human's words: "the git
    # commit thing should work across whole repo, not just .olai files edited
    # through MCP". `git status` had always surveyed these files; the panel
    # dropped them one line later, because olai only lists the files it writes.
    #
    # Two of them, so the PIECEMEAL half is real: one goes in, one stays
    # waiting for a commit and a message of its own.
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
    # A path and a status, and deliberately nothing more: the only richer thing
    # available for a document is a text diff, which this feature has never
    # shown.
    Then the panel lists "notes.md" as "untracked"
    And the panel lists "later.md" as "untracked"
    And the panel says it covers the whole repository
    When I untick "later.md"
    # The offer follows the ticks, or the selection is a lie about what pressing
    # the button will record.
    Then the commit button offers "Commit 1 file"
    When I commit with the message "the herb bed needs splitting"
    # The one that was left out is still counted, which is both the assertion
    # and the wait: the pill polls, so what follows reads a log the server has
    # already written.
    Then the commit pill says 1 uncommitted
    And the last commit is "olai: the herb bed needs splitting" by "web"
    And the last commit touched exactly "notes.md"
    And "later.md" is still waiting in the repository
    And there should be no page errors

  Scenario: What is recorded and not shared says so, in the header and in the panel
    # "I think 'push' is the only thing that makes me use CLI outside of olai" —
    # the human. An audit trail that lives on one machine is one disk failure
    # from not existing, so the count rides the header pill as well as the
    # panel, and one button sends it.
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
    # The pill first, because it is the thing that POLLS: it goes quiet when the
    # server has answered and republished, which is what says the push is
    # finished rather than in flight.
    Then the commit pill says 0 unpushed
    And the remote has "olai: the herb bed needs splitting"
    And there should be no page errors

  Scenario: A commit from this browser is pushed when Auto-push is on
    # The pref is this browser's, so it governs the Commit button here and
    # nowhere else. Agent `commit` ops and `--commit=auto` are server-side and
    # are not this. The existing scenario above is today's behaviour: commit,
    # then Push. This one is the composition — the same op, without pressing
    # Push — and it earns the browser because the pill's unpushed count is a
    # live cell: it goes to 0 when the server has republished, which is what
    # says the push landed rather than sitting in flight.
    Given the served repository has a remote
    When I open the preferences
    And I set Git to "on"
    Then the Git row explains that a commit "is pushed"
    And this browser has stored that auto-push is "on"
    When I press Escape on the preferences
    Then the preferences are shut
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    And I open the commit panel
    And I commit with the message "the herb bed needs splitting"
    # The pill first, because it is the thing that POLLS: `committed` is the
    # commit having landed (without it, `0 unpushed` is the count from BEFORE
    # the write, and a skipped push would pass), then `0 unpushed` is the
    # push having landed.
    Then the commit pill says "committed"
    And the last commit is "olai: the herb bed needs splitting" by "web"
    And the commit pill says 0 unpushed
    And the remote has "olai: the herb bed needs splitting"
    And there should be no page errors

  Scenario: A repository that cannot take a commit says so instead of doing nothing
    # The hole this whole feature closed: nothing used to check, so an agent
    # marking a node done mid-rebase could swallow a resolution.
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
    When I open the commit panel
    Then the panel says the repository is "detached"
    And the commit button is disabled
    And there should be no page errors
