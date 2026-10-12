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
  are six hours, fifteen minutes and twenty minutes — and `@sleep-off` writes
  the pass's own switch into the same row before the server boots.

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
    And the node "hinges" has the title "tidied"
    And node "install" carries the sleep memo
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"

  @scratch:chat @git:repo
  Scenario: A sleep is not repeated while the memory has not moved again
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And the memory under "install" has moved
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the node agent "install" has been tidied
    And node "install" carries the sleep memo
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    When the sleep pass has had its chance
    Then olai has recorded 1 commit here

  @scratch:chat @git:repo @sleep-off
  Scenario: The pass is off, and no node is tidied
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And the memory under "install" has moved
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And the sleep pass has had its chance
    Then the node agent "install" has not been tidied
    And node "install" carries no sleep memo
    And olai has recorded 0 commits here

  @alerts @scratch:chat @git:repo
  Scenario: A question inside a sleep is never announced, and is stopped
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    # AFTER the outline is open, and that is not tidiness: the worker step reads
    # `navigator.serviceWorker`, which a page still on `about:blank` does not
    # have — every other `@alerts` scenario reaches the app in its Background
    # first, and this one has none.
    And the notification worker is ready
    And the memory under "install" has moved
    When the next sleep asks a question
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the sleep's question is waiting
    And the chat shows a question
    When I close the agent fold
    # THE READER LOOKS AWAY, so the alert faces are live — and the pass is then
    # given its chance, which is what makes the silence below an absence rather
    # than a race with a banner that has not been drawn yet.
    And the sleep pass has had its chance
    Then no chime rang
    And no notification has been raised
    And the tab says nothing is waiting
    And the agent "install" stands "working"
    And Needs you is absent
    And the server log warns that "install" did not finish: "it asked a question nobody is there to answer, so it was stopped"
    Then node "install" carries no sleep memo
    And olai has recorded 0 commits here
    And the agent "install" stands "idle"
    And Needs you is absent

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
    And the memo on node "install" is the pass's own
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    And olai has recorded 1 commit here

  @scratch:chat @git:repo @policy:git.commit=auto
  Scenario: Under commit: auto the pass's writes are its own commit
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And the memory under "install" has moved
    When the next sleep holds its turn open
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And the quiet window is given its full run
    Then olai has recorded 0 commits here
    When the agent is released
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    Then olai has recorded 1 commit here
