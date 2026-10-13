@sleep-fast
Feature: A node agent tidies its own memory when nobody is looking

  A subtree is a node agent's only memory and nothing ever compacts it. After a
  month a health log is hundreds of kilobytes of records whose titles are whole
  daily reports, the standing facts they support have to be re-derived by hand,
  and nothing is archived. So olai gives the agent one machine turn of its own:
  a node left alone long enough whose memory has moved since it last slept is
  asked to tidy, distill and tuck away — in its own conversation, with the tools
  it already has — and the whole pass is one commit a person can revert.

  These scenarios hold the four things a person could check: the row in the
  transcript, the memo on the node, the commit in the log, and the one thing a
  sleep must never do, which is wake somebody. The spans are the scenario's own
  (`@sleep-fast` writes them into the chat row, the same words an operator would
  write), because the product's are hours — and `@sleep-off` writes the pass's
  own switch into the same row before the server boots.

  The fake agent's behaviour is chosen by marker files rather than by anything
  said to it: the pass always sends the same words, so there is no verb a
  scenario could type (`packages/tests/agent/scripted-acp.ts` reads them).

  THE NEWS COMES LAST. `the memory under <node> has moved` is the only thing that
  makes a node a candidate — the corpus's rows carry no stamps, and a subtree
  nobody has written to is one the pass correctly leaves alone — so a marker a
  scenario writes after it is a marker the pass may race on its next `sleep-tick`
  (250 ms here) and take an ordinary turn before. Every scenario below therefore
  writes its marker first and moves the memory after it.

  AND NOTHING IS TIDIED UNTIL SOMEBODY ASKS. The pass is opt-in per chat, off by
  default, so a scenario that wants the LOOP to pick a node up turns that node's
  sleep on first — through the row-menu verb a person presses, never by writing
  the property from the fixture — and the two scenarios that are about the mark
  being absent or taken off say so themselves.

  @scratch:chat @git:repo
  Scenario: A node agent whose memory moved sleeps, and the pass is one commit
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    # THE CONVERSATION FIRST, and that is not staging: the corpus carries no
    # binding at all, so opening this node's agent is what SEATS one — and the
    # row's menu has no chat verbs until it is.
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    # ...AND THE OPT-IN, PRESSED ON SCREEN: the verb on the row's menu, read back
    # twice — the vault holds the mark, and the menu that comes back says the
    # other thing, because the label IS the indicator.
    When I open the node menu of "install"
    And I choose "Sleep when idle" from the node menu
    Then the vault node "install" has property "chat-agent-sleep" holding "on"
    When I open the node menu of "install"
    And the node menu offers "Stop sleeping when idle"
    And I click away from the node menu
    And the memory under "install" has moved
    Then the node agent "install" has been tidied
    And the node "hinges" has the title "tidied"
    And node "install" carries the sleep memo
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"

  @scratch:chat @git:repo
  Scenario: A sleep is not repeated while the memory has not moved again
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    When I open the node menu of "install"
    And I choose "Sleep when idle" from the node menu
    And the memory under "install" has moved
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
    And I open the node menu of "install"
    And I choose "Sleep when idle" from the node menu
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
  Scenario: A session may not write the memo of its own sleep, or its own mark
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When the next sleep writes the memo itself
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the node menu of "install"
    And I choose "Sleep when idle" from the node menu
    And the memory under "install" has moved
    Then the chat shows a failed tool call
    And the agent's answer mentions "is a property this door may not write"
    # BOTH KEYS, and the backticks are load-bearing: `chat-agent-sleep` is a
    # substring of `chat-agent-slept`, so an assertion without them would pass on
    # the memo's refusal alone.
    And the agent's answer mentions "`chat-agent-slept` is a property"
    # ...AND THE SECOND KEY IS TRIED IN THE SAME TURN (the fake writes
    # `chat-agent-sleep` too). What that key's refusal looks like on the wire is
    # NOT asserted here: the door's rule is held by `@olai/ops`' own case (a
    # session write to this key is refused, both directions) and by
    # `server.ts`'s third clause, and the live ticket a node agent's tools carry
    # does not yet forbid it — an open finding, reported on the PR rather than
    # asserted as if it held.
    And the memo on node "install" is the pass's own
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    And olai has recorded 1 commit here

  @scratch:chat @git:repo @policy:git.commit=auto
  Scenario: Under commit: auto the pass's writes are its own commit
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When the next sleep holds its turn open
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the node menu of "install"
    And I choose "Sleep when idle" from the node menu
    And the memory under "install" has moved
    And the quiet window is given its full run
    Then olai has recorded 0 commits here
    When the agent is released
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    Then olai has recorded 1 commit here

  @sleep-fast @scratch:chat @git:repo
  Scenario: Sleep now sleeps a node the loop would never have picked up
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    # NOTHING HERE IS DUE, and that is the half that makes the verb the thing
    # that did it: the corpus's rows carry no stamps, so the loop's "the memory
    # has moved" test is false for this node and it is never a candidate — the
    # other scenarios write `the memory under … has moved` for exactly that.
    #
    # AND NOBODY HAS ASKED, deliberately: this node carries no `chat-agent-sleep`
    # mark for the whole scenario, which is the other half — a person's press
    # runs the pass on a chat the loop would not have touched for either reason.
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And the sleep pass has had its chance
    Then olai has recorded 0 commits here
    And the node agent "install" has not been tidied
    And node "install" carries no sleep memo
    # ...AND A PERSON ASKS, from ⌘K. The conversation on screen IS this node's,
    # which is what the palette's one row is about: it names the node it would
    # act on, and with no node agent's conversation shown there is no row at all.
    When I press the palette shortcut
    And I type "sleep now" into the palette
    And I press the palette row "sleep-now"
    Then the node agent "install" has been tidied
    And node "install" carries the sleep memo
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    And olai has recorded 1 commit here

  @sleep-fast @scratch:chat @git:repo
  Scenario: The verb is refused, and starts nothing, while olai is tidying
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When the next sleep holds its turn open
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the node menu of "install"
    And I choose "Sleep when idle" from the node menu
    And the memory under "install" has moved
    # THE PASS IS MID-TURN: the fake holds its turn open, so the permit is held
    # and this node's turn is marked as olai's own.
    Then the node agent "install" has been tidied
    # ...AND A SECOND ASK IS REFUSED, in the row's own said line — naming the
    # node it is already tidying, which is what a person is waiting for.
    When I open the node menu of "install"
    And I choose "Sleep now" from the node menu
    Then the node menu of "install" says "olai is already tidying install the cabinets; wait for it to finish"
    # ...AND NOTHING SECOND STARTED: the one commit here is the held pass's own,
    # which lands when the fake lets go. The wait is the one every scenario uses
    # for a commit a MACHINE made — the count below is an immediate read, and a
    # commit is a moment after the turn ends.
    When the agent is released
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    Then olai has recorded 1 commit here

  @sleep-fast @scratch:chat @git:repo
  Scenario: A sleep a person cancels writes nothing, and is not remembered
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When the next sleep holds its turn open
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the node menu of "install"
    And I choose "Sleep when idle" from the node menu
    And the memory under "install" has moved
    Then the node agent "install" has been tidied
    # A PERSON STOPS IT, which is the one press the pass must not read as a
    # finished sleep: a cancelled turn lands on `idle` with no trouble.
    When I cancel the turn
    Then the server log warns that "install" did not finish: "its turn was cancelled before it finished, so nothing was written"
    # ...AND THE NODE IS NOT LEFT ALONE FOR A DAY: the loop's own next look tries
    # again, and THAT pass completes — which is what says nothing was remembered
    # against a node somebody stopped.
    And node "install" carries the sleep memo
    # ...AND THE RETRY'S COMMIT, waited for: the memo above is written BEFORE the
    # commit, and the count below is an immediate read — the race the step above
    # exists to lose.
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    And olai has recorded 1 commit here

  @sleep-fast @scratch:chat @git:repo
  Scenario: A sleep cannot write outside its own subtree
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    # THE FENCE'S TWO CASES, in one turn: a property on a node that is NOT under
    # the one being tidied, and a trash of it. Both would land outside the pass's
    # own commit — under `auto` once the hold releases, or waiting — so reverting
    # the sleep would not undo them.
    When the next sleep writes outside its subtree at "kitchen"
    And the next sleep trashes "kitchen"
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the node menu of "install"
    And I choose "Sleep when idle" from the node menu
    And the memory under "install" has moved
    # BOTH REFUSED, in the fence's own words — and the pass still finishes: what
    # it was asked to do was inside the subtree.
    Then the chat shows a failed tool call
    And the agent's answer mentions "olai is tidying this node's memory"
    And node "install" carries the sleep memo
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    And olai has recorded 1 commit here

  @sleep-fast @scratch:chat @git:repo
  Scenario: A node agent nobody asked for is left alone, however due it is
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    # NOBODY HAS SAID YES: the memory moves, so the loop's own tests are all
    # satisfied and this node would be tidied on the next tick — and the mark is
    # the one thing missing, which is the whole of what the opt-in is.
    And the memory under "install" has moved
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And the sleep pass has had its chance
    Then the node agent "install" has not been tidied
    And node "install" carries no sleep memo
    And olai has recorded 0 commits here

  @sleep-fast @scratch:chat @git:repo
  Scenario: Stop sleeping when idle stops it, and nothing is tidied after that
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    # THE CONVERSATION FIRST: the corpus carries no binding, and the row's menu
    # has no chat verbs until one is seated.
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    # ON, THEN OFF, through the two labels the one verb carries — and each press
    # is read back off the menu that comes after it, because the label IS the
    # indicator: `chat-agent-sleep` is gone when the row says "Sleep when idle"
    # again.
    When I open the node menu of "install"
    And I choose "Sleep when idle" from the node menu
    When I open the node menu of "install"
    And the node menu offers "Stop sleeping when idle"
    And I choose "Stop sleeping when idle" from the node menu
    When I open the node menu of "install"
    And the node menu offers "Sleep when idle"
    And I click away from the node menu
    # ...AND THE NEWS COMES AFTER THE MARK IS OFF, which is the order that makes
    # this about the mark: the node is due on every test the loop has, and it is
    # still left alone.
    And the memory under "install" has moved
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And the sleep pass has had its chance
    Then the node agent "install" has not been tidied
    And node "install" carries no sleep memo
    And olai has recorded 0 commits here
