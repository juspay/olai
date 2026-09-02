Feature: A failed MCP server is a visible fact
  An MCP server that fails to attach to a conversation used to be invisible.
  The only trace was a debug-level log line and a session quietly short of its
  tools: the panel drew a healthy conversation, the agent could not see kolu's
  terminals, and the way to find out which of those was true was to read olai's
  log from outside the app. The incident that filed this was debugged exactly
  that way.

  So the panel says it, under the header, where the model and the session title
  already are — with the reason the probe or the server itself gave, because
  "kolu did not attach" is the one thing every way of failing has in common and
  the one thing that never helped anybody.

  The fake `kolu` in `agent/kolu/` is what every server this suite spawns finds
  first on its PATH, and the tag decides which one it is: the DEFAULT reaches no
  daemon (the wrong-build case, juspay/kolu#2146), and `@kolu` is a host whose
  padi answers. So the two scenarios below differ only in whether the host's
  kolu works — the panel, the agent and the conversation are the same.

  `odu` needs no such fake: the wrapper the suite spawns (`OLAI_BIN`, the
  nix-built binary or `just dev-bin`'s own) answers that probe from its own
  pin — which IS the isolation, on a laptop that has a real odu too. There
  is NO scenario-side arm for it the way `@kolu` is one: isolateEnv deletes
  the host's `OLAI_ODU_BIN`, so the wrapper's default is the only value any
  server here ever sees. A scenario that needs another odu answer adds the
  knob the way `@kolu` and `@padi:` were added — the shape is right there.

  Background:
    Given I open the app
    And the agent panel is open

  @scratch:chat
  Scenario: The server that did not attach is named, with its reason
    Then the panel says "kolu" is missing from this conversation
    And the reason it gives is "padi transport down"
    And it names the file it probed

  @scratch:chat
  Scenario: The fact belongs to the conversation, not to the boot
    # Probed again for every conversation — a padi started after olai is picked
    # up by the next one — so the fact is re-established rather than remembered,
    # and it is dropped with the session it was about. A panel that only ever
    # heard this at boot draws a healthy session over a broken kolu from the
    # second conversation onwards.
    # A turn first, so the transcript emptying below is a change rather than a
    # state it was already in — and so the conversation being left is one the
    # agent had actually opened. Which servers it got is the scripted agent's
    # `servers` answer, not this panel's.
    When I ask the agent "hello"
    Then the agent is idle
    When I start a new conversation
    Then the chat is empty
    And the panel says "kolu" is missing from this conversation

  @phone @scratch:chat
  Scenario: The same fact on a phone
    # The two layouts share one `Face`, so the sheet CANNOT draw a different
    # panel than the dock — which is an argument, and this is the assertion.
    # A future split of that component would otherwise be caught on a desktop
    # viewport only, and a phone is where a person is least able to go and read
    # a log instead.
    Then the panel says "kolu" is missing from this conversation
    And the reason it gives is "padi transport down"

  @scratch:chat @kolu
  Scenario: A conversation that got everything says nothing new
    # The first two lines are load-bearing here: without them "the panel says
    # nothing" would also pass for a session that silently lacked kolu, which
    # is the exact state this whole feature exists to make impossible. The two
    # facts have to be asserted together.
    When I ask the agent "servers"
    Then the agent's answer mentions "servers: [olai kolu odu]"
    And the panel says nothing about a missing server
