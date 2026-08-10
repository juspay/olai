Feature: Talking to the agent
  The panel is the second write surface, and the first one that exists. What it
  has to be is one thing: a place where asking for something CHANGES the
  outline in front of you, and where a change that was refused says why in
  terms you can act on.

  Every scenario here is `@scratch:chat` — the agent writes, so the directory
  is a private copy with a server of its own — and the agent behind them is the
  scripted one in `support/fake-acp-agent.ts`. It calls the real internal MCP
  server over the real HTTP route, so what is being tested is the whole path
  minus the language model: panel, surface, ops, write gate, disk, store, and
  back to the page.

  Background:
    Given I have the outline open
    And the agent panel is open

  @scratch:chat
  Scenario: The agent checks something off and the tree follows
    # The claim the roadmap item is written against: ask, and watch the outline
    # update — no reload, no optimistic echo, the server's own snapshot.
    When I ask the agent "done order"
    Then node "order" is done
    And the page has not reloaded
    And the agent's answer mentions "marked"

  @scratch:chat
  Scenario: The agent captures a node and it appears in the tree
    When I ask the agent "add water the plants"
    Then the tree eventually shows a node titled "water the plants"

  @scratch:chat
  Scenario: A refused write shows its unfinished children in chat
    # `kitchen` takes its status from its children, so it cannot store one.
    # The refusal is data: the panel draws the children that are in the way,
    # which are what to mark instead.
    When I ask the agent "done kitchen"
    Then the chat shows a refusal
    And the refusal lists the unfinished children:
      | order   |
      | install |
    And node "kitchen" is not done

  @scratch:chat
  Scenario: A tool call is one foldable line
    When I ask the agent "done order"
    Then the chat shows a completed tool call
    And the tool call's detail is folded away

  @scratch:chat
  Scenario: A turn can be cancelled mid-stream
    When I ask the agent "slow"
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    And the chat says the turn was cancelled

  @scratch:chat
  Scenario: The input completes the agent's own slash commands
    # The list is the AGENT'S — olai keeps none of its own — so what is offered
    # is whatever that agent reported over the session.
    When I type "/re" into the chat
    Then the completion offers "review"
    When I accept the completion
    Then the chat input reads "/review "

  @agent-stored @scratch:chat
  Scenario: Boot adopts the conversation this directory was last in
    # `session/list` for this directory answers with two, and the most recently
    # updated one is the one the panel comes up in — replayed, before anybody
    # types.
    Then the chat eventually shows "we decided to order the cabinets"
    And the conversation is titled "the last conversation"

  @agent-stored @scratch:chat
  Scenario: The conversation survives a restart of the server
    Given the chat eventually shows "we decided to order the cabinets"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the chat eventually shows "we decided to order the cabinets"

  @agent-stored @scratch:chat
  Scenario: The picker switches conversations
    When I open the session picker
    Then the picker lists "an older conversation"
    When I pick the conversation "an older conversation"
    Then the conversation is titled "an older conversation"
