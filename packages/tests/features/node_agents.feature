Feature: A node with an `agent` property IS an agent
  Creating a node agent is creating an olai node. Put an `agent` property on any
  node and an agent is associated with it: the node's title is its name, its
  note is its charter, and its SUBTREE is its memory. A chat session bound to it
  is cattle — thrown away and made again at any time — because what the agent
  knows is written in the outline rather than in a transcript.

  Which is why the AGENTS roster in the column is not a list anybody maintains.
  It is literally the query `prop:agent`, answered where the set is: put the
  property on and the row is there, take it off and the row is gone. These
  scenarios are that sentence held to, on a board that carries the property on
  eight of its rows and on none of the others.

  The other half of a node agent is a SESSION, and in this phase the node↔session
  pointer is written by hand into this machine's own state — there is no assign
  gesture yet, and no conversation olai serves here has been bound to anything.
  So what these scenarios pin is the half that is a fact about the VAULT, plus
  the honest face of the half that is not: an agent nobody has bound a session
  to says `no session bound` rather than drawing as asleep, which would claim a
  conversation that does not exist. What the panel does once one IS bound is
  unit-tested where the join is (`@olai/web`'s `agents/roster.test.ts`), because
  every one of those states is a fact about the panel's own cell rather than
  about a directory.

  @corpus:lanes
  Scenario: The roster is the query, and nothing else
    # Eight rows carry `agent` on this board and six do not. The roster is the
    # eight — including the ones on lanes that are FINISHED, because the query
    # says nothing about `done` and a roster that quietly dropped them would be
    # deciding something nobody asked for. Taking the property off is how a row
    # leaves.
    Given I open the outline "lanes.olai"
    Then the agents roster holds 8 agents
    And the agents roster lists "door-implement"
    And the agents roster lists "door-review"
    And the agents roster lists "quiet-implement"
    # The node's TITLE is the agent's name, live off the set — there is no copy
    # of it anywhere for a rename to make stale.
    And the agent "door-review" is named "review: grok"

  @corpus:lanes
  Scenario: An agent nobody has bound a session to says so, on both its faces
    # The roster row and the door are two faces of one answer, addressed by the
    # same node id — so this is also the assertion that they cannot disagree.
    Given I open the outline "lanes.olai"
    Then the agent "door-implement" stands "unbound"
    And the door on "door-implement" stands "unbound"
    And the door on "door-implement" reads "no session bound"
    # ... and an agent olai has never been in a conversation with draws no line
    # at all, which is not the same as drawing an empty one.
    And the door on "door-implement" has no last message

  @corpus:lanes
  Scenario: The door says what the agent is and how much it knows
    # The memory count is the number this whole design turns on: the subtree is
    # what a fresh session would read, so how big it is belongs on the row
    # beside the state. A leaf lane step has nothing under it and says `0 rows`
    # rather than nothing.
    #
    # What the door does NOT say is the node's own title, which is one line
    # above it every time — the engine and the memory are what only the door
    # can say, and they get the width.
    Given I open the outline "lanes.olai"
    Then the door on "door-implement" reads "claude"
    And the door on "door-implement" reads "memory: this subtree (0 rows)"

  @corpus:lanes
  Scenario: A row with no `agent` property wears no door
    # Nearly every row in every outline is this one, and what it costs is a
    # lookup in a roster of eight.
    Given I open the outline "lanes.olai"
    Then there is no door on "lane-door"
    And there is no door on "lanes"

  @corpus:good
  Scenario: A directory with no node agent has no section at all
    # Not an empty box, not a heading, not a hint — the shelf's own rule, and
    # here it is also the column's budget: a section drawn on every serve would
    # spend a line of a one-screen column on every directory to say nothing
    # about most of them.
    Given I open the outline "garden.olai"
    Then the agents roster is not drawn

  # ── the keystone: what an agent-associated session is told ────────────

  @scratch:lanes
  Scenario: An agent-associated session is taught its contract, once
    # The rule the whole record exists for. A binding is hand-written in this
    # phase and read at BOOT, so the scenario writes one and restarts — which
    # is also the honest shape of the only binding gesture there is.
    Given I open the outline "lanes.olai"
    And the node "door-implement" is bound to this directory's conversation
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the agent "door-implement" stands "idle"
    When I ask the agent "what is blocking the connector?"
    Then the agent was told its contract 1 time
    And the contract names "implement + open PR" and its subtree
    # ... and the second message says nothing. This is the assertion the
    # `taught` record is kept for: nothing in the transcript carries the rule,
    # so a session that was not written down would hear it again here.
    When I ask the agent "and now?"
    Then the agent was told its contract 1 time

  @scratch:lanes
  Scenario: ... and a restart does not say it again
    # The other half of "written down": the record outlives the process, so a
    # serve that came back would otherwise re-teach on every boot — forever,
    # about something the agent was told days ago.
    Given I open the outline "lanes.olai"
    And the node "door-implement" is bound to this directory's conversation
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    And I ask the agent "what is blocking the connector?"
    Then the agent was told its contract 1 time
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    And I ask the agent "still there?"
    # The conversation was resumed, so the replay brings the old rows back —
    # and no new contract with them.
    Then the agent was told its contract 1 time
