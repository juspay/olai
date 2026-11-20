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

  THE NEWS COMES LAST, AND IT IS NOT ENOUGH ON ITS OWN. A subtree nobody has
  written to is one the pass correctly leaves alone, so `the memory under <node>
  has moved` is what makes a node a candidate at all — the corpus's rows carry no
  stamps. What makes it DUE is pressure: enough rows moved (`sleep-floor`, two in
  a fast scenario), one row on a node that has never slept, or one row that has
  waited `sleep-latest`. The rows a scenario moves are stamped at the clock's now
  for that last clause's sake, and a marker a scenario writes afterwards is a
  marker the pass may race on its next `sleep-tick`
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
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    When I switch sleep when idle on for this conversation
    Then sleep when idle is on for this conversation
    And the vault node "install" has property "chat-agent-sleep" holding "on"
    And the memory under "install" has moved
    Then the node agent "install" has been tidied
    And the node "hinges" has the title "tidied"
    And node "install" carries the sleep memo
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    And the sleep item says "unchanged"
    And the sleep item has a memo

  @scratch:chat @git:repo
  Scenario: A sleep is not repeated while the memory has not moved again
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    When I open the node menu of "install"
    And I choose "Sleep when idle" from the node menu
    And I open the node menu of "install"
    And the node menu offers "Stop sleeping when idle"
    And I click away from the node menu
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
    Then the sleep item says "off"
    And the sleep pass has had its chance
    Then the node agent "install" has not been tidied
    And node "install" carries no sleep memo
    And olai has recorded 0 commits here

  @alerts @scratch:chat @git:repo
  Scenario: A question inside a sleep is never announced, and is stopped
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And the notification worker is ready
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I close the agent fold
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
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And the chat shows a question
    And the server log warns that "install" did not finish: "it asked a question nobody is there to answer, so it was stopped"
    Then the sleep item says "skipped"
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
    Then the sleep turn has tried to write the memo itself
    And the chat shows a failed tool call
    And the agent's answer mentions "is a property this door may not write"
    And the agent's answer mentions "`chat-agent-slept` is a property"
    And the agent's answer mentions "`chat-agent-sleep` is a property"
    And the vault node "install" has property "chat-agent-sleep" holding "on"
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
    Then the sleep item says "running"
    And olai has recorded 0 commits here
    When the agent is released
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    Then olai has recorded 1 commit here

  @sleep-fast @scratch:chat @git:repo
  Scenario: Tidy memory tidies a node the loop would never have picked up
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And the sleep pass has had its chance
    Then olai has recorded 0 commits here
    And the node agent "install" has not been tidied
    And node "install" carries no sleep memo
    When I press the palette shortcut
    And I type "tidy memory" into the palette
    And I press the palette row "tidy-memory"
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
    Then the node agent "install" has been tidied
    When I open the node menu of "install"
    And I choose "Tidy memory" from the node menu
    Then the node menu of "install" says "olai is already tidying install the cabinets; wait for it to finish"
    When I open the Chats menu of "install"
    And I choose "Tidy memory" from the Chats menu
    Then the Chats menu of "install" says "olai is already tidying install the cabinets; wait for it to finish"
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
    When I cancel the turn
    Then the server log warns that "install" did not finish: "its turn was cancelled before it finished, so nothing was written"
    And node "install" carries the sleep memo
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    And olai has recorded 1 commit here

  @sleep-fast @scratch:chat @git:repo
  Scenario: A sleep cannot write outside its own subtree
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When the next sleep writes outside its subtree at "kitchen"
    And the next sleep trashes "kitchen"
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the node menu of "install"
    And I choose "Sleep when idle" from the node menu
    And the memory under "install" has moved
    Then the chat shows a failed tool call
    And the agent's answer mentions "olai is tidying this node's knowledge base"
    And node "install" carries the sleep memo
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    And olai has recorded 1 commit here

  @sleep-fast @scratch:chat @git:repo
  Scenario: A node agent nobody asked for is left alone, however due it is
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And the memory under "install" has moved
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the sleep item says "unmarked"
    And the sleep pass has had its chance
    Then the node agent "install" has not been tidied
    And node "install" carries no sleep memo
    And olai has recorded 0 commits here

  @sleep-fast @scratch:chat @git:repo
  Scenario: Stop sleeping when idle stops it, and nothing is tidied after that
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    When I switch sleep when idle on for this conversation
    Then sleep when idle is on for this conversation
    When I open the node menu of "install"
    And the node menu offers "Stop sleeping when idle"
    And I choose "Stop sleeping when idle" from the node menu
    When I open the node menu of "install"
    And the node menu offers "Sleep when idle"
    And I click away from the node menu
    And sleep when idle is off for this conversation
    And the memory under "install" has moved
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And the sleep pass has had its chance
    Then the node agent "install" has not been tidied
    And node "install" carries no sleep memo
    And olai has recorded 0 commits here

  @scratch:chat @git:repo
  Scenario: The line says when this chat last slept, and takes a press
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    Then the sleep item and the wake faces share one strip
    And the sleep item says "unmarked"
    When I switch sleep when idle on for this conversation
    Then the sleep item says "unchanged"
    And the sleep item has no memo
    When I narrow the window to a phone's width
    Then the standing line has wrapped
    When I press Tidy memory on the strip
    Then the node agent "install" has been tidied
    And the sleep item has a memo
    And the last commit becomes "olai: sleep: install the cabinets" by "sleep"
    And olai has recorded 1 commit here

  @sleep-fast @scratch:chat @git:repo
  Scenario: Too few rows is not a sleep, and the line says so
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    When I switch sleep when idle on for this conversation
    When I press Tidy memory on the strip
    Then the node agent "install" has been tidied
    And node "install" carries the sleep memo
    When one row under "install" has moved
    Then the sleep item says "little"
    And the sleep item mentions "1 of 2 rows"
    When one row under "install" has moved
    Then the sleep item says "due"
    Then the node agent "install" has been tidied
    When the sleep pass has had its chance
    Then olai has recorded 2 commits here
