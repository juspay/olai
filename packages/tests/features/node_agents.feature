Feature: A node with an `agent-session` property IS an agent
  Creating a node agent is creating an olai node. Put an `agent-session`
  property on any node and an agent is associated with it: the node's title is
  its name, its note is its charter, and its SUBTREE is its memory. A chat
  session bound to it is cattle — thrown away and made again at any time —
  because what the agent knows is written in the outline rather than in a
  transcript.

  Which is why the AGENTS roster in the column is not a list anybody maintains.
  It is literally the query `prop:agent-session`, answered where the set is: put
  the property on and the row is there, take it off and the row is gone. These
  scenarios are that sentence held to, on a board that carries the property on
  nine of its rows and on none of the others.

  ONE KEY CARRIES BOTH HALVES. The property says which ENGINE the node's agent
  runs on and WHICH CONVERSATION it is talking through — `claude`, or
  `claude:<session>` — so the binding is a fact about the VAULT since the
  human's ruling of 2026-09-02, and a directory arrives at olai already bound or
  not at all, with no second file anywhere to keep in step. The board below has
  one of each: eight node agents nobody has started a session for, and one whose
  property names the conversation its serve opens.

  @corpus:lanes
  Scenario: The roster is the query, and nothing else
    # Nine rows carry `agent-session` on this board and six do not. The roster
    # is the nine — including the ones on lanes that are FINISHED, because the
    # query says nothing about `done` and a roster that quietly dropped them
    # would be deciding something nobody asked for. Taking the property off is
    # how a row leaves, and putting it on is how one arrives — which is what
    # the `•••` verb below does in one press.
    Given I open the outline "lanes.olai"
    Then the agents roster holds 9 agents
    And the agents roster lists "door-implement"
    And the agents roster lists "door-review"
    And the agents roster lists "quiet-implement"
    # The node's TITLE is the agent's name, live off the set — there is no copy
    # of it anywhere for a rename to make stale.
    And the agent "door-review" is named "review: grok"

  @corpus:lanes
  Scenario: An agent nobody has started a session for says so, on both its faces
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
  Scenario: A row with no `agent-session` property wears no door
    # Nearly every row in every outline is this one, and what it costs is a
    # lookup in a roster of nine.
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

  # ── the gesture that binds one ────────────────────────────────────────

  @scratch:lanes
  Scenario: Starting an agent session on a BARE node is what creates the node agent
    # The verb WRITES the property; it does not require one (the human, testing
    # the deployed head, 2026-09-02). `lane-fresh` carries nothing at all —
    # which is nearly every row of every outline — so before the press it is
    # not a node agent and wears no door.
    #
    # The engine is the machine's, and this serve has exactly one installed, so
    # there is nothing to ask: the entry is one plain line.
    Given I open the outline "lanes.olai"
    Then there is no door on "lane-fresh"
    When I open the node menu of "lane-fresh"
    And I choose "Start an agent session" from the node menu
    # One press, and the node IS one: the property carries both halves, and the
    # roster — which is that query — has a row it did not have, wearing a door
    # that says which engine.
    Then the node "lane-fresh" shows the property "agent-session" holding "claude:fake-session-1"
    And the agents roster holds 10 agents
    And the agents roster lists "lane-fresh"
    And the door on "lane-fresh" reads "claude"
    #
    # WHAT IS NOT ASSERTED HERE is the standing, and the reason is the scripted
    # agent rather than the panel: it answers every `session/new` with one id,
    # so a node bound in this serve names the conversation the fixture's
    # pre-bound row already names, and which of the two the panel reports as
    # `bound` is the first-node-wins rule doing its job. That the panel follows
    # a binding is asserted where nothing collides — the keystone below.

  @scratch:lanes
  Scenario: ... and on a node that already names an engine, it uses that one
    # The other half of *which engine*: `door-implement` carries
    # `agent-session: claude` with no session, so it said which agent it is and
    # nothing gets to second-guess that. Two acts, one press, and the ORDER is
    # the guarantee — the vault never names a session that was not opened.
    Given I open the outline "lanes.olai"
    Then the agent "door-implement" stands "unbound"
    When I open the node menu of "door-implement"
    And I choose "Start an agent session" from the node menu
    # The property now carries both halves, which is the durable half of the
    # answer: this survives the restart, because it is in the file — and its
    # engine is the one the node already named rather than one picked for it.
    Then the node "door-implement" shows the property "agent-session" holding "claude:fake-session-1"
    # ... and the door says so without being told twice: it read `no session
    # bound` a moment ago, and the row is the query.
    And the door on "door-implement" reads "claude"
    And the door on "door-implement" does not read "no session bound"

  @corpus:lanes
  Scenario: A node agent that already has a session is not offered a new one
    # The fence read from the other side. `door-live`'s property names a
    # conversation, so the verb that would replace it is simply not in the menu
    # — a *fresh session* is a different verb, with a different warning about
    # what happens to the transcript, and it is not this phase's.
    Given I open the outline "lanes.olai"
    When I open the node menu of "door-live"
    Then the node menu does not offer "Start an agent session"

  # ── the keystone: what an agent-associated session is told ────────────

  @scratch:lanes
  Scenario: An agent-associated session is taught its contract, once
    # The rule the whole record exists for. The binding is a FIXTURE FACT
    # rather than a step — `door-live` carries `agent-session:
    # claude:fake-session-1`, and that session is the one the scripted agent
    # answers `session/new` with every time, so this directory arrives at olai
    # already bound, which is the shape a person's is in when they open it.
    Given I open the outline "lanes.olai"
    And the agent panel is open
    # The binding took: the roster says this agent is the conversation the
    # panel is in, which is the half `bound` answers.
    Then the agent "door-live" stands "idle"
    When I ask the agent "what is blocking the connector?"
    Then the agent was told its contract 1 time
    And the contract names "watch the connector" and its subtree
    # ... and the second message says nothing. This is what the `taught` record
    # is kept for: nothing in the transcript carries the rule, so a session
    # that was not written down would hear it again here.
    When I ask the agent "and now?"
    Then the agent was told its contract 1 time
    # ... and the door has the line, on the frame the write published rather
    # than whenever something else next moves the panel. The scripted agent
    # says back what it was given, so the last thing olai heard is the question.
    And the door on "door-live" last said "and now?"

  @scratch:lanes
  Scenario: ... and a restart does not say it again
    # The other half of "written down": the record outlives the process, so a
    # serve that came back would otherwise re-teach on every boot — forever,
    # about something the agent was told days ago. THAT record is this
    # machine's, and it stays this machine's: what olai overheard a conversation
    # do is bookkeeping, and a board written to on every turn is a board
    # committed on every turn.
    Given I open the outline "lanes.olai"
    And the agent panel is open
    And I ask the agent "what is blocking the connector?"
    Then the agent was told its contract 1 time
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    And I ask the agent "still there?"
    Then the agent was told its contract 0 times

  # ── migration: the chats that are nobody's yet ────────────────────────
  #
  # Migration is ASSOCIATION, NOT CONVERSION. Nothing moves on disk and no
  # transcript is copied anywhere: what a press writes is one property, and from
  # that frame the conversation is that node agent's current session with its
  # context intact.
  #
  # These scenarios run on a serve whose agent has TWO stored conversations, one
  # of them a `/clear` behind the other (`agent/fake-acp-agent.ts`) — which is
  # what makes the chain assertable — and the panel comes up in the newer of
  # them, which is the state a person migrating is actually in: talking in a
  # chat that belongs to nobody.

  @agent-stored @scratch:lanes
  Scenario: The roster ends with the conversations no node claims
    # Two conversations are stored here and the nine node agents name neither,
    # so both are waiting for a home. The COUNT is the news this row carries,
    # which is why it is asserted rather than the row's presence alone.
    Given I open the outline "lanes.olai"
    Then the agents roster holds 9 agents
    And the roster offers 2 unassigned chats

  @agent-stored @scratch:good
  Scenario: A directory with no node agent still draws the section, for the chats
    # The other end of the shelf's rule, and the ruling this phase adds to it: a
    # person migrating has no node agents yet, so a doorway that appeared only
    # once they had made one by hand would be a doorway nobody finds. What the
    # section holds here is the one row.
    Given I open the outline "garden.olai"
    Then the agents roster holds 0 agents
    And the roster offers 2 unassigned chats

  @agent-stored @scratch:lanes
  Scenario: Assigning a chat writes the one property, and claims its chain
    # The whole gesture. `lane-fresh` carries nothing at all — so this is also
    # how a node agent comes into being — and the conversation it takes is the
    # newer of the stored pair, the one the older was superseded BY.
    Given I open the outline "lanes.olai"
    Then there is no door on "lane-fresh"
    When I open the unassigned chats
    Then the unassigned list holds "the last conversation"
    And the unassigned list holds "an older conversation"
    When I assign the conversation "the last conversation" to the node titled "a lane nobody has put an agent on", searching for "lane nobody"
    # ONE PROPERTY, carrying both halves — the engine off the chat itself, and
    # the conversation it already was.
    Then the node "lane-fresh" shows the property "agent-session" holding "claude:fake-stored-new"
    And the agents roster holds 10 agents
    And the door on "lane-fresh" reads "claude"
    # ... AND THE CHAIN RIDES ALONG: the conversation this one replaced is that
    # agent's history rather than a chat nobody claims, so the list empties on
    # one press rather than two.
    And the unassigned list does not hold "an older conversation"
    And the roster offers no unassigned chats

  @agent-stored @scratch:lanes
  Scenario: A node already talking through a conversation cannot take another
    # One agent, one current session. `door-live`'s property names a
    # conversation, so it is in the search and cannot be taken — dimmed where a
    # reader scanning the list can see it, with the reason under the list rather
    # than after a press that failed.
    Given I open the outline "lanes.olai"
    When I open the unassigned chats
    And I look for a node to give "the last conversation" to, with "watch the connector"
    And I point the assign search at "watch the connector"
    Then the assign search refuses it, saying "one agent, one current session"
    # ... and the press writes nothing: the property still names the
    # conversation it named before anybody pressed anything, and the chat is
    # still waiting for a home.
    When I take the node the assign search refused
    Then the node "door-live" shows the property "agent-session" holding "claude:fake-session-1"
    And the roster offers 2 unassigned chats

  @agent-stored @scratch:lanes
  Scenario: An assigned session is taught the MIGRATION contract, once
    # The distillation order, and the reason assigning is a procedure rather
    # than a property write from a browser: nothing in a transcript says a
    # conversation was moved to a node, so the fact is written down when the
    # gesture runs and read when that session next says something.
    #
    # The panel is already IN the conversation being assigned — a boot with
    # stored conversations comes back to the most recent — which is the ordinary
    # way this happens: you are talking in a chat, and you give it a home.
    Given I open the outline "lanes.olai"
    And the agent panel is open
    When I open the unassigned chats
    And I assign the conversation "the last conversation" to the node titled "a lane nobody has put an agent on", searching for "lane nobody"
    And I close the unassigned chats
    And I ask the agent "where were we?"
    Then the agent was told its contract 1 time
    And the contract says the conversation was assigned
    And the contract orders it to bank what it knows into the subtree
    # ... and it is said once, like every other contract: the second message
    # says nothing.
    When I ask the agent "and now?"
    Then the agent was told its contract 1 time

  @corpus:lanes
  Scenario: A node agent's panel offers a fresh session, labelled with what it means
    # The affordance the panel owed a person and did not have. It says what
    # happens to the transcript, because that sentence is the whole reason it is
    # safe to press: the memory is the subtree, and a fresh session reads it.
    Given I open the outline "lanes.olai"
    And the agent panel is open
    Then the agent "door-live" stands "idle"
    When I open the session picker
    Then the panel offers a fresh session, saying "memory is the subtree"
    And the panel offers a fresh session, saying "the transcript becomes history"

  @agent-stored @scratch:lanes
  Scenario: ... and names the conversations this agent has had before this one
    # Assigning claims the `/clear` chain in one gesture, so *past sessions* is
    # populated from day one rather than starting empty and filling as somebody
    # clears. `lane-fresh` takes the newer conversation; the older one — the
    # conversation it superseded — is its history.
    Given I open the outline "lanes.olai"
    And the agent panel is open
    When I open the unassigned chats
    And I assign the conversation "the last conversation" to the node titled "a lane nobody has put an agent on", searching for "lane nobody"
    And I open the session picker
    Then the panel says this agent has had 1 past session
    And the past sessions hold "an older conversation"

  @agent-stored @scratch:lanes
  Scenario: A conversation no node claims is the picker it has always been
    # The negative, and it is what keeps the block honest: *past sessions* and
    # *fresh session* are a NODE AGENT's, so a chat that is nobody's has
    # neither. Both halves in one scenario, because the claim is the difference
    # between them rather than either on its own — the panel comes up in a
    # stored conversation no node names, and one press puts it in one that is
    # named.
    Given I open the outline "lanes.olai"
    And the agent panel is open
    When I open the session picker
    Then the panel offers no fresh session
    When I press the door on "door-live"
    And I open the session picker
    Then the panel offers a fresh session, saying "memory is the subtree"
