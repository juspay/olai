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

  The fake `kolu` in the kolu plugin's `e2e/fake/` is what every server this suite spawns finds
  first on its PATH, and the tag decides which one it is: the DEFAULT reaches no
  daemon, and `@kolu` is a host whose padi answers. The live-versus-stale
  discrimination runs in `an_external_agent.feature`'s last scenario: the same
  `external kolu outlines_done {}` line succeeds with the tag and is refused
  at the wire without it, so the two hosts cannot be mistaken for each other.
  The odu row beside it needs
  no fake: the wrapper the suite spawns (`OLAI_BIN`, the nix-built binary or
  `just dev-bin`'s own) answers the probe from its own pin, on a laptop that
  has a real odu too — isolateEnv deletes the host's `OLAI_ODU_BIN`, so the
  wrapper's default is the only value any server here ever sees
  (`a_failed_mcp_server.feature` says the whole of it).

  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"

  @scratch:chat @kolu
  Scenario: The servers this conversation was handed are named
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the panel says this conversation has "olai"
    And the panel says this conversation has "kolu"
    And the panel says the list is not the whole of it

  @scratch:chat @kolu
  Scenario: Handing a server over is not the same as the agent having it
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the panel does not claim the agent attached "olai"
    And the panel does not claim the agent attached "kolu"
    When I ask the agent "hello"
    Then the agent is idle
    And the panel says the agent attached "olai"
    And the panel says the agent attached "kolu"

  @scratch:chat @kolu
  Scenario: A server the agent could not attach says so, in the agent's words
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "attach kolu needs-auth"
    Then the agent is idle
    When I ask the agent "hello"
    Then the agent is idle
    And the panel says the agent could not attach "kolu"
    And the reason it gives for "kolu" is "needs-auth"
    And the panel says the agent attached "olai"

  @scratch:chat
  Scenario: An installed command is handed over without probing daemon health
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the panel says this conversation has "olai"
    And the panel says this conversation has "kolu"
    And the panel does not claim the agent attached "kolu"
    And the panel says nothing about a missing server

  @scratch:chat @kolu
  Scenario: The roster belongs to the conversation, not to the boot
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hello"
    Then the agent is idle
    When I start a fresh session
    Then the chat is empty
    And the panel says this conversation has "olai"
    And the panel says this conversation has "kolu"
    And the panel does not claim the agent attached "kolu"

  @scratch:chat @kolu
  Scenario: A refused fresh session keeps the current conversation and its roster
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the panel says this conversation has "olai"
    When the agent refuses to new a conversation
    And I start a fresh session
    Then the fresh-session control refuses "this agent will not start a conversation in this directory" and allows retry
    When I press "Escape"
    Then the panel says this conversation has "olai"

  @no-agent @scratch:chat @kolu
  Scenario: No conversation, no roster
    Then no agent fold is open
    And the agent start pill on "kitchen" is absent

  @opencode @scratch:chat @kolu
  Scenario: An agent that reports nothing per server still gets its servers named
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "hello"
    Then the chat eventually shows "opencode says: hello"
    And the panel says this conversation has "olai"
    And the panel says this conversation has "kolu"
    And the panel does not claim the agent attached "olai"
    And the panel says the list is not the whole of it

  @omp @scratch:chat @kolu
  Scenario: An agent that reports nothing per server still gets its servers named
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "hello"
    Then the chat eventually shows "omp says: hello"
    And the panel says this conversation has "olai"
    And the panel says this conversation has "kolu"
    And the panel does not claim the agent attached "olai"
    And the panel says the list is not the whole of it
