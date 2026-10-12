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

  THE NEWS COMES LAST. `the memory under <node> has moved` is the only thing that
  makes a node a candidate — the corpus's rows carry no stamps, and a subtree
  nobody has written to is one the pass correctly leaves alone — so a marker a
  scenario writes after it is a marker the pass may race on its next `sleep-tick`
  (250 ms here) and take an ordinary turn before. Every scenario below therefore
  writes its marker first and moves the memory after it.

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
    # THE CONVERSATION IS OPENED, THEN SHUT, AND THE QUESTION COMES AFTER IT.
    # Nobody is watching when the turn is handed over, which is the state these
    # assertions are about: `alarmFor` chimes on a count that RISES while
    # unwatched, so a fold opened first and closed afterwards would raise no
    # alarm either way and the three silences below would prove nothing.
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I close the agent fold
    # ...AND THE MARKER COMES BEFORE THE NEWS, which is what keeps the pass from
    # taking an ordinary turn first (the header says why).
    When the next sleep asks a question
    And the memory under "install" has moved
    Then the sleep's question is waiting
    And the sleep pass has had its chance
    Then no chime rang
    And no notification has been raised
    And the tab says nothing is waiting
    And the agent "install" stands "working"
    And Needs you is absent
    # ...AND THE QUESTION IS REALLY THERE, which the fold has to open for — a
    # count that has not risen raises nothing, so this costs the silence above
    # nothing and is the only face a page has for a question the mark keeps out
    # of the alert faces.
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And the chat shows a question
    And the server log warns that "install" did not finish: "it asked a question nobody is there to answer, so it was stopped"
    # A TICK'S WORTH AFTER THE CANCEL, and it is what the reads below are timed
    # against: the fake deletes its marker once it has read it, so a pass that
    # had not remembered the question would come back at the next tick as an
    # ORDINARY sleep and write the memo this scenario says is not there.
    When the sleep pass has had its chance
    Then node "install" carries no sleep memo
    And olai has recorded 0 commits here
    And the agent "install" stands "idle"
    And Needs you is absent

  @scratch:chat @git:repo
  Scenario: A session may not write the memo of its own sleep
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When the next sleep writes the memo itself
    And the memory under "install" has moved
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
    When the next sleep holds its turn open
    And the memory under "install" has moved
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And the quiet window is given its full run
    Then olai has recorded 0 commits here
    When the agent is released
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    Then olai has recorded 1 commit here

  @sleep-fast @scratch:chat @git:repo
  Scenario: Tidy memory now tidies a node the loop would never have picked up
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    # NOTHING HERE IS DUE, and that is the half that makes the verb the thing
    # that did it: the corpus's rows carry no stamps, so the loop's "the memory
    # has moved" test is false for this node and it is never a candidate — the
    # other scenarios write `the memory under … has moved` for exactly that.
    When the sleep pass has had its chance
    Then olai has recorded 0 commits here
    And the node agent "install" has not been tidied
    # ...AND A PERSON ASKS, from ⌘K — the surface their hands are already on.
    When I press the palette shortcut
    And I type "tidy memory" into the palette
    And I pick the palette's "Tidy memory now" row for "install"
    Then the node agent "install" has been tidied
    And node "install" carries the sleep memo
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    And olai has recorded 1 commit here

  @sleep-fast @scratch:chat @git:repo
  Scenario: The verb is refused, and starts nothing, while olai is tidying
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When the next sleep holds its turn open
    And the memory under "install" has moved
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    # THE PASS IS MID-TURN: the fake holds its turn open, so the permit is held
    # and this node's turn is marked as olai's own.
    Then the node agent "install" has been tidied
    # ...AND A SECOND ASK IS REFUSED, in the row's own said line — naming the
    # node it is already tidying, which is what a person is waiting for.
    When I open the node menu of "install"
    And I choose "Tidy memory now" from the node menu
    Then the node menu of "install" says "olai is already tidying install the cabinets; wait for it to finish"
    # ...AND NOTHING SECOND STARTED: the one commit here is the held pass's own,
    # which lands when the fake lets go. The wait is the one every scenario uses
    # for a commit a MACHINE made — the count below is an immediate read, and a
    # commit is a moment after the turn ends.
    When the agent is released
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    Then olai has recorded 1 commit here
