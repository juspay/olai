Feature: Kolu's terminals, when this host has them
  Kolu runs coding agents in terminals and serves them over MCP. If this host
  is running one, the panel's agent should be able to see those terminals
  without anybody configuring anything — so olai looks for kolu every time a
  conversation is opened and hands the session what it finds, alongside its own
  tools.

  What makes that a claim worth a scenario is the way it can go wrong. A `kolu`
  on PATH is not necessarily the host's kolu: a padi-spawned terminal prepends
  its own bundled copy, and one of those was an older build reporting the same
  version string while missing most of the verbs. It still SPAWNS. So the test
  for "kolu is running here" is not that a binary was found — it is that a
  daemon answered it, and both scenarios below have the binary.

  The fake `kolu` in `agent/kolu/` is what every server this suite spawns finds
  first on its PATH, and the tag is what decides which one it is. Nothing here
  simulates a terminal: what a scenario can ask is which MCP servers the
  SESSION was given, which the scripted agent reports when asked.

  Background:
    Given I open the app
    And the agent panel is open

  @scratch:chat @kolu
  Scenario: A host running kolu gives the conversation its terminals
    When I ask the agent "servers"
    Then the agent's answer mentions "servers: [olai kolu]"

  @scratch:chat
  Scenario: A kolu that reaches no padi is not one this host is running
    # The wrong-build case, which is also the no-daemon case: they look the
    # same from here, and the right answer to both is the same too.
    When I ask the agent "servers"
    Then the agent's answer mentions "servers: [olai]"
