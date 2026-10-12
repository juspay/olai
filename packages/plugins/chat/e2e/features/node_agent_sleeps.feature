@sleep-fast
Feature: A node agent tidies its own memory when nobody is looking

  A subtree is a node agent's only memory and nothing ever compacts it. After a
  month a health log is hundreds of kilobytes of records whose titles are whole
  daily reports, the standing facts they support have to be re-derived by hand,
  and nothing is archived. So olai gives the agent one machine turn of its own:
  a node left alone for six hours whose memory has moved since it last slept is
  asked to tidy, distill and tuck away — in its own conversation, with the tools
  it already has — and the whole pass is one commit a person can revert.

  These scenarios hold the four things a person could check: the row in the
  transcript, the memo on the node, the commit in the log, and the one thing a
  sleep must never do, which is wake somebody. The spans are the scenario's own
  (`@sleep-fast` writes `sleep-after`, `sleep-tick` and `sleep-question` into
  the chat row, the same words an operator would write), because the product's
  are six hours, fifteen minutes and twenty minutes.

  The fake agent's behaviour is chosen by marker files rather than by anything
  said to it: the pass always sends the same words, so there is no verb a
  scenario could type (`packages/tests/agent/scripted-acp.ts` reads them).

  @scratch:chat @git:repo
  Scenario: A node agent whose memory moved sleeps, and the pass is one commit
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And the memory under "install" has moved
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the node agent "install" has been tidied
    And node "install" carries the sleep memo
    And the last commit is "olai: sleep: install the cabinets" by "sleep"

  @scratch:chat @git:repo
  Scenario: A sleep is not repeated while the memory has not moved again
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And the memory under "install" has moved
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the node agent "install" has been tidied
    And node "install" carries the sleep memo
    And the sleep pass has had its chance
    And olai has recorded 1 commit here

  @scratch:chat @git:repo
  Scenario: The pass is off, and no node is tidied
    Given the harness keeps distinct sessions on disk
    And the sleep pass is off
    And I open the outline "house.olai"
    And the memory under "install" has moved
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the node agent "install" has not been tidied
    And node "install" carries no sleep memo
    And olai has recorded 0 commits here

  @scratch:chat @git:repo
  Scenario: A question inside a sleep is never announced, and is stopped
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And the memory under "install" has moved
    When the next sleep asks a question
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the agent "install" stands "working"
    And Needs you is absent
    And the server log says "asked a question nobody is there to answer"
    And node "install" carries no sleep memo
    And olai has recorded 0 commits here

  @scratch:chat @git:repo
  Scenario: A session may not write the memo of its own sleep
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And the memory under "install" has moved
    When the next sleep writes the memo itself
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the chat shows a failed tool call
    And the agent's answer mentions "is a property this door may not write"

  @scratch:chat @git:repo @policy:git.commit=auto
  Scenario: Under commit: auto the pass's writes are its own commit
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And the memory under "install" has moved
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the node agent "install" has been tidied
    And olai has recorded 1 commit here
    And the last commit is "olai: sleep: install the cabinets" by "sleep"
    When the quiet window is given its full run
    Then olai has recorded 1 commit here
