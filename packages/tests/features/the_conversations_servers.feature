Feature: The panel says which MCP servers a conversation has
  "What MCP servers do you have?" is a question people ask their agent, and the
  agent is the worst thing in the room to ask: nothing in a conversation's
  context is a record of what it was handed. The incident that filed this is
  exactly that — an opencode asked the question listed olai and deepwiki,
  omitted kolu, and then called `kolu_lifecycle_create` perfectly.

  So the panel answers it, under the header where the model and the session
  title already are. #140 drew this strip for FAILURES only and deliberately
  nothing on a healthy session; what it draws now is the whole roster, with a
  standing per server — and the failures keep their verbatim sentences, which
  is what `a_failed_mcp_server.feature` goes on asserting.

  Three layers, and each is only as certain as who spoke for it. Olai knows
  what it HANDED the session, because it composed the list. Whether the agent
  ATTACHED any of it is knowable only where the agent says so — ACP's
  `session/new` answers with a session id and not one word per server, and the
  Claude Code adapter is the leg that volunteers it, on the same forwarded
  `init` the running model comes from. And what the agent brought of its OWN is
  in neither, which is why the strip says "plus the agent's own" on every
  conversation rather than letting the list read as complete.

  The fake `kolu` in `agent/kolu/` is what every server this suite spawns finds
  first on its PATH, and the tag decides which one it is: the DEFAULT reaches no
  daemon, and `@kolu` is a host whose padi answers. The odu row beside it needs
  no fake: the wrapper the suite spawns (`OLAI_BIN`, the nix-built binary or
  `just dev-bin`'s own) answers the probe from its own pin, on a laptop that
  has a real odu too — isolateEnv deletes the host's `OLAI_ODU_BIN`, so the
  wrapper's default is the only value any server here ever sees
  (`a_failed_mcp_server.feature` says the whole of it).

  Background:
    Given I open the app
    And the agent panel is open

  @scratch:chat @kolu
  Scenario: The servers this conversation was handed are named
    # The whole point, on a host where nothing is wrong. There was no strip at
    # all in this state before — a person wondering what the agent could reach
    # had the model to ask and nothing else.
    Then the panel says this conversation has "olai"
    And the panel says this conversation has "kolu"
    And the panel says the list is not the whole of it

  @scratch:chat @kolu
  Scenario: Handing a server over is not the same as the agent having it
    # The layering, as the two states a person can actually see. A conversation
    # nobody has spoken in yet has been HANDED its servers and nothing more:
    # the agent's `init` arrives as a turn starts, so until then a tick would be
    # olai asserting a fact it does not have — which is the mistake the model
    # made.
    Then the panel does not claim the agent attached "olai"
    And the panel does not claim the agent attached "kolu"
    When I ask the agent "hello"
    Then the agent is idle
    And the panel says the agent attached "olai"
    And the panel says the agent attached "kolu"

  @scratch:chat @kolu
  Scenario: A server the agent could not attach says so, in the agent's words
    # The fact olai could not report AT ALL before this: its own probe answered,
    # the server was handed over, and the AGENT is the only thing that knows
    # what became of it. `needs-auth` and `failed` want different things done
    # about them, so the agent's own word is what the panel repeats.
    #
    # Two turns, because the adapter's `init` is emitted as a turn STARTS: the
    # turn that changes the answer has already announced the old one. That is
    # the real wire's shape, and the same beat a `/model` is heard on.
    When I ask the agent "attach kolu needs-auth"
    Then the agent is idle
    When I ask the agent "hello"
    Then the agent is idle
    And the panel says the agent could not attach "kolu"
    And the reason it gives is "needs-auth"
    # ... and the conversation is not otherwise diminished: olai's own server is
    # still there and still attached, which is the difference between "one
    # server did not arrive" and "something is broken".
    And the panel says the agent attached "olai"

  @scratch:chat
  Scenario: An installed command is handed over without probing daemon health
    # The default fake kolu cannot read daemon identity. Discovery must still
    # hand it over and must not claim its actual connection has succeeded.
    Then the panel says this conversation has "olai"
    And the panel says this conversation has "kolu"
    And the panel does not claim the agent attached "kolu"
    And the panel says nothing about a missing server

  @scratch:chat @kolu
  Scenario: The roster belongs to the conversation, not to the boot
    # Probed again for every conversation — a padi started after olai is picked
    # up by the next one — so the answer is re-established rather than
    # remembered. A panel that only ever heard this at boot would draw the first
    # conversation's servers over every conversation after it.
    When I ask the agent "hello"
    Then the agent is idle
    When I start a new conversation
    Then the chat is empty
    And the panel says this conversation has "olai"
    And the panel says this conversation has "kolu"
    # The TICK is gone with the conversation it was about. Nobody has spoken in
    # this one yet, and the agent's word about the last one is not a fact about
    # this one.
    And the panel does not claim the agent attached "kolu"

  @scratch:chat @kolu
  Scenario: A conversation the agent refused has no roster either
    # THE OTHER no-conversation face, and the one that is easy to miss: the
    # roster is composed and announced BEFORE `session/new` is asked, because
    # it IS the list that call is handed. So an open that comes back a NO
    # leaves a strip that was drawn on the way to a conversation which then
    # never existed — answering "which servers does this conversation have?"
    # about nothing at all, over a body that is busy saying there is no
    # conversation.
    #
    # The first line is load-bearing: without it "the panel says nothing" would
    # also pass for a roster that had never been drawn, and what is asserted
    # here is that it is DROPPED.
    Then the panel says this conversation has "olai"
    When the agent refuses to new a conversation
    And I start a new conversation
    Then the panel says the conversation could not be opened
    And the panel says nothing about this conversation's servers

  @no-agent @scratch:chat @kolu
  Scenario: No conversation, no roster
    # EMPTY MEANS "THERE IS NO CONVERSATION", not "everything arrived" — which
    # is the one thing this member changed about #140's, where an empty list was
    # a healthy session. Servers are handed at session open, so a panel that was
    # never able to open one has been handed nothing, and there is nothing to
    # list. A strip drawn here would be answering "which servers does this
    # conversation have?" about no conversation.
    #
    # `@kolu` is deliberate: this host IS running kolu, so the absence is about
    # there being no session rather than about there being nothing to say.
    Then the panel says there is no agent
    And the panel says nothing about this conversation's servers

  @opencode @scratch:chat @kolu
  Scenario: An agent that reports nothing per server still gets its servers named
    # The other leg, and the honest floor of this feature. Opencode forwards no
    # messages of its own, so there is no source for the middle layer at all —
    # every row stays at "handed over, and nobody has said what became of it".
    # That is a real answer to the question this feature exists for, and it is
    # the one the panel gives rather than inventing a tick or drawing nothing.
    When I choose the agent "opencode"
    And I ask the agent "hello"
    Then the chat eventually shows "opencode says: hello"
    And the panel says this conversation has "olai"
    And the panel says this conversation has "kolu"
    And the panel does not claim the agent attached "olai"
    And the panel says the list is not the whole of it
