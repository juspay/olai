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
  Scenario: An unbound agent wears a standing in the aside
    Given I open the outline "lanes.olai"
    Then the aside on "door-implement" stands "unbound"
    And the aside on "door-implement" reads "no session bound"
    And the standing on "door-implement" cannot be pressed

  @scratch:lanes
  Scenario: Hovering a plain row offers a single press to start its agent
    Given I open the outline "lanes.olai"
    When I hover the agent start pill on "lane-fresh"
    Then the agent start pill on "lane-fresh" is visible
    When I press the agent start pill on "lane-fresh"
    Then the vault node "lane-fresh" has property "agent-session" holding "claude:fake-session-1"
    And node agent "lane-fresh" is unfolded
    And the agent start pill on "lane-fresh" is absent

  @codex @scratch:lanes
  Scenario: Several installed engines offer a choice at the row
    Given I open the outline "lanes.olai"
    When I hover the agent start pill on "lane-fresh"
    And I press the agent start pill on "lane-fresh"
    Then the agent engine menu offers "Claude Code"
    And the agent engine menu offers "Codex"

  @corpus:lanes
  Scenario: A bound row has a standing and no start pill
    Given I open the outline "lanes.olai"
    Then the agent start pill on "door-live" is absent

  @scratch:lanes
  Scenario: A waiting agent agrees on the aside and sidebar faces
    Given I open the outline "lanes.olai"
    When I press the agent "door-live"
    And I ask the agent "ask"
    Then the chat shows a question
    And the agent "door-live" stands "needs-you"
    And the aside on "door-live" stands "needs-you"
    And the aside on "door-live" reads "needs you"

  @scratch:good
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
    Then the vault node "lane-fresh" has property "agent-session" holding "claude:fake-session-1"
    And the agents roster holds 10 agents
    And the agents roster lists "lane-fresh"
    And the header names the agent "claude"
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
    Then the vault node "door-implement" has property "agent-session" holding "claude:fake-session-1"
    # ... and the door says so without being told twice: it read `no session
    # bound` a moment ago, and the row is the query.
    And the header names the agent "claude"
    And the node agent's fold is ready

  @scratch:lanes
  Scenario: ... and the conversation is opened in the node's own scope, not moved into it
    # THE BUG A SCRIPTED AGENT ALMOST CANNOT SHOW, and what it cost: against the
    # adapter olai SHIPS this gesture did not work at all.
    #
    # A bare node is on no roster — the roster is the query over the binding
    # property, and this gesture is what WRITES one — so the scheduler read
    # "not a node agent" as "not a node", opened the conversation in the
    # unscoped panel, wrote the property, and then MOVED the conversation into
    # the node's scope. Moving one is `session/load`, and no engine has written
    # a session it has only just minted and nobody has spoken into: the load
    # came back `Resource not found`, and the node was left naming a
    # conversation nothing could open.
    #
    # This agent loads any id it is handed, so the shape is unreachable head-on.
    # Told to REFUSE a load it becomes reachable exactly: a gesture that opens
    # its conversation where it belongs never asks for a load at all, and one
    # that has to move it asks for the one thing this agent will not do. The
    # refusal is armed BEFORE the press, so it is the relocation's own load that
    # meets it and not some later verb's.
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    When the agent refuses to load a conversation
    And I open the node menu of "lane-fresh"
    And I choose "Start an agent session" from the node menu
    # The two acts in their order, unchanged: the conversation, then the
    # property that names it.
    Then the vault node "lane-fresh" has property "agent-session" holding "claude:fake-session-1"
    And the agent "lane-fresh" stands "idle"
    # THE CLAIM. Nothing was re-opened, so nothing was refused — and the panel
    # is in a conversation rather than on the third body explaining why it is
    # not.
    And the panel shows no such refusal
    And there is somewhere to type into

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
    And I press the agent "door-live"
    And the node agent's fold is ready
    # The binding took: the roster says this agent is the conversation the
    # panel is in, which is the half `bound` answers.
    Then the agent "door-live" stands "idle"
    And this conversation's "kolu" wake is on nothing
    And this conversation's "odu" wake is on nothing
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
    And the agent's answer mentions "you said: and now?"

  # ── wake choices belong to the conversation; writes reach the vault ────────────────

  @scratch:lanes
  Scenario: A node agent can write a sibling outside its subtree
    # The subtree is the session's home, not its territory. `door-review` is a
    # sibling of the seat, and the write lands the same way a loopback MCP
    # write would.
    Given I open the outline "lanes.olai"
    And I show the done nodes
    And I press the agent "door-live"
    And the node agent's fold is ready
    Then the agent "door-live" stands "idle"
    When I ask the agent "ready"
    And the agent is idle
    When I ask the agent "done door-review"
    Then the agent is idle
    And the node "door-review" has status "done"
    And the chat shows no refusal

  @scratch:lanes
  Scenario: A node agent may write its own subtree
    # At the root counts as inside. This is the same MCP tool and the same
    # writer as the sibling call above; only the planned footprint
    # differs.
    Given I open the outline "lanes.olai"
    And I show the done nodes
    And I press the agent "door-live"
    And the node agent's fold is ready
    Then the agent "door-live" stands "idle"
    When I ask the agent "ready"
    And the agent is idle
    When I ask the agent "done door-live"
    Then the agent is idle
    And the node "door-live" has status "done"
    And the chat shows no refusal

  @agent-stored @scratch:lanes
  Scenario: Two node agents converse at once, with both roster rows live
    # The current unassigned conversation becomes `lane-fresh`'s. Its slow
    # turn then stays alive while the panel moves to `door-live`, whose own
    # process loads its own conversation and answers independently.
    Given I open the outline "lanes.olai"
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I ask the agent "slow"
    Then the agent "filed-chat" stands "working"
    When I press the agent "door-live"
    Then the agent "filed-chat" stands "working"
    And the agent "door-live" stands "idle"
    When I ask the agent "the second conversation"
    Then the agent has answered "the second conversation" exactly once
    And the agent "filed-chat" stands "working"
    When the agent is released

  @scratch:lanes
  Scenario: ... and a restart does not say it again
    # The other half of "written down": the record outlives the process, so a
    # serve that came back would otherwise re-teach on every boot — forever,
    # about something the agent was told days ago. THAT record is this
    # machine's, and it stays this machine's: what olai overheard a conversation
    # do is bookkeeping, and a board written to on every turn is a board
    # committed on every turn.
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    And I ask the agent "what is blocking the connector?"
    Then the agent was told its contract 1 time
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    And I ask the agent "still there?"
    # The anchor first: the count means nothing until the round trip has
    # answered — 0 is where every count starts.
    And the agent has answered "still there?" exactly once
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
  Scenario: Stored conversation heads are filed and every agent starts asleep
    Given I open the outline "lanes.olai"
    Then the Inbox has 1 filed conversations
    And the agents roster holds 10 agents
    And all bound node agents are asleep
    And the Unassigned row and list are absent
    When I open the filed conversation "the last conversation" as node "filed-chat"
    Then the node "filed-chat" keeps the session "claude:fake-stored-new" in file "_olai/Inbox.olai"
    When I ask the agent "where were we?"
    Then the agent was told its contract 1 time
    And the contract says the conversation was assigned
    When I open the session picker
    Then the past sessions hold "an older conversation"

  @agent-stored @scratch:good
  Scenario: Stored chats create node agents in a directory that had none
    Given I open the outline "garden.olai"
    Then the Inbox has 1 filed conversations
    And the agents roster holds 1 agents
    And all bound node agents are asleep
    And the Unassigned row and list are absent

  @agent-stored @scratch:lanes
  Scenario: Moving a filed conversation keeps its identity and history
    Given I open the outline "lanes.olai"
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I open the node menu of "filed-chat"
    And I choose "Move to…" from the node menu
    And I search the move picker for "lane nobody"
    And I choose "a lane nobody has put an agent on" from the move picker
    Then the node "filed-chat" keeps the session "claude:fake-stored-new" in file "lanes.olai"
    When I open the outline "backlog.olai"
    And I press the agent "filed-chat"
    Then the sidebar marks the outline "lanes.olai" as the one open
    When I open the session picker
    Then the past sessions hold "an older conversation"
    And the Unassigned row and list are absent

  @agent-stored @scratch:lanes
  Scenario: Trashing a filed conversation does not resurrect it on the next boot
    Given I open the outline "lanes.olai"
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I open the node menu of "filed-chat"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then the node "filed-chat" keeps the session "claude:fake-stored-new" in file "_olai/Trash.olai"
    When the server stops
    And the server starts again on the same port
    And I open the outline "lanes.olai"
    Then the filer's boot run has settled
    And the Inbox has 0 filed conversations
    And the agents roster holds 9 agents

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
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I ask the agent "where were we?"
    Then the agent was told its contract 1 time
    And the contract says the conversation was assigned
    And the contract orders it to bank what it knows into the subtree
    # ... and it is said once, like every other contract: the second message
    # says nothing.
    When I ask the agent "and now?"
    Then the agent was told its contract 1 time

  @agent-stored @scratch:lanes
  Scenario: ... and a restart does not teach the migration contract again
    # The human's report of 2026-09-02 on the team deploy: an opencode
    # conversation ASSIGNED to a node agent, taught its migration contract on
    # the message after the assign — and the same preamble rode the next
    # message after a redeploy, nowhere near the session's first. The rule is
    # the one every contract keeps: once per session, and it is written down;
    # neither does a restart say it again.
    Given I open the outline "lanes.olai"
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I ask the agent "where were we?"
    Then the agent was told its contract 1 time
    And the contract says the conversation was assigned
    # THE REDEPLOY: the process goes down, the tab comes up against a new one,
    # and the message that follows is nowhere near the conversation's first.
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    And I ask the agent "still there?"
    # The anchor first: the count means nothing until the round trip has
    # answered — 0 is where every count starts.
    And the agent has answered "still there?" exactly once
    Then the agent was told its contract 0 times

  @corpus:lanes
  Scenario: A node agent's panel offers a fresh session, labelled with what it means
    # The affordance the panel owed a person and did not have. It says what
    # happens to the transcript, because that sentence is the whole reason it is
    # safe to press: the memory is the subtree, and a fresh session reads it.
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    Then the agent "door-live" stands "idle"
    When I open the session picker
    Then the panel offers a fresh session, saying "memory is the subtree"
    And the panel offers a fresh session, saying "the transcript becomes history"

  @agent-stored @scratch:lanes
  Scenario: A node agent whose conversation the engine has lost can still be got out of
    # THE TRAP, and it is a trap rather than a refusal: every part of it is
    # working as designed and the person cannot move.
    #
    # A node's property names a conversation. The engine no longer has that
    # conversation — a `claude --resume` store cleared, a machine changed, an id
    # that was never theirs — so `session/load` answers `no such conversation`
    # and the panel draws the refusal, which is right. What it offers is *try
    # again*, which asks for the SAME thing and will be refused for ever.
    #
    # The one gesture that CAN move — a fresh session, which re-points the
    # property — was reachable from two places and neither of them is open:
    #
    #   - the panel's session picker, which is drawn only where the conversation
    #     belongs to a node, and a refused load means there is no conversation;
    #   - the row's `•••`, which withholds *Start an agent session* precisely
    #     because the node HAS a session (`one agent, one current session`).
    #
    # So the two rules that are each correct alone close on a person together.
    # This scenario is the trap and its way out.
    #
    # `@agent-stored` is what puts the panel somewhere ELSE first: boot adopts a
    # stored conversation, so pressing the agent is a real `session/load` of the
    # one its property names rather than a press on the conversation already
    # open. That is also how a person arrives — a tab that was reading something
    # else, and an agent whose conversation is gone.
    Given I open the outline "lanes.olai"
    When the agent refuses to load a conversation
    And I press the agent "door-live"
    Then the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "no such conversation"
    # THE FIRST CLAIM, and the whole of the trap: the panel knows WHOSE
    # conversation it could not open. The header goes on naming the node agent,
    # which is what draws that agent's own session control — a refused open used
    # to drop the binding along with the conversation, and the control with it.
    And the panel header names the node agent "watch the connector"
    # THE WAY OUT, under the words that make it safe to press. It is the picker's
    # own fresh session, unmoved: the memory is the subtree, so nothing a person
    # wrote is being thrown away, and *try again* is still there beside it for an
    # engine that had merely lost its store for a moment.
    When I open the session picker
    Then the panel offers a fresh session, saying "memory is the subtree"
    # ...and pressing it moves. A fresh conversation is `session/new`, which this
    # agent never refused — it said no to the old one — so the node comes back to
    # a conversation and the refusal is off the screen.
    When I start a fresh session
    Then the panel shows no such refusal
    And the agent "door-live" stands "idle"
    And the vault node "door-live" has property "agent-session" holding "claude:fake-session-1"

  @agent-stored @scratch:lanes
  Scenario: ... and names the conversations this agent has had before this one
    # Assigning claims the `/clear` chain in one gesture, so *past sessions* is
    # populated from day one rather than starting empty and filling as somebody
    # clears. `lane-fresh` takes the newer conversation; the older one — the
    # conversation it superseded — is its history.
    Given I open the outline "lanes.olai"
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I open the session picker
    Then the panel says this agent has had 1 past session
    And the past sessions hold "an older conversation"

  @agent-stored @scratch:lanes
  Scenario: A filed conversation has the node session controls immediately
    Given I open the outline "lanes.olai"
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I open the session picker
    Then the panel offers a fresh session, saying "memory is the subtree"
    And the past sessions hold "an older conversation"

  @agent-stored @scratch:lanes
  Scenario: A refused listing is named in the filer log and writes no rows
    Given I open the outline "lanes.olai"
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I ask the agent "lose"
    Then the filer log names "claude" with "the conversation store is unreadable"
    And the Inbox has 1 filed conversations
    And the Unassigned row and list are absent

  @codex @scratch:chat
  Scenario: A settled turn files a terminal conversation through its running engine
    Given the harness keeps distinct sessions on disk
    And the listing counter is armed
    And I open the outline "house.olai"
    And the filer's boot run has settled
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And I ask the agent "cabinet conversation"
    And the agent is idle
    And a terminal stores a conversation titled "terminal conversation"
    And the agent starts so far are counted
    And the list-asks so far are counted
    And I ask the agent "check again"
    And the agent is idle
    Then the list-asks have grown
    And the Inbox has 1 filed conversations
    And no further agent process has started
    When I open the filed conversation "terminal conversation" as node "terminal-chat"
    Then the chat shows my message "terminal conversation"

  @agent-stored @scratch:lanes
  Scenario: Pressing an agent in the sidebar does BOTH halves of what it means
    # The sibling of *A conversation no node claims has no sessions of its
    # own*, from the press's other face. A door press switches the panel and
    # navigates nowhere — the reader is already on the node; a SIDEBAR press
    # owes both at once: the outline at the agent's own row AND the panel
    # switched to its conversation (`@olai/web`'s `agents/focus.ts`). The
    # failure this catches is exactly one half of that working: a press that
    # navigates and leaves the panel where it was looks, to a person, exactly
    # like a press that worked — because the page moved — and an assertion of
    # the navigation alone would pass straight over it.
    #
    # It starts on `backlog.olai`, not `lanes.olai`: the navigation half is
    # real only if the press has to CARRY the reader somewhere, and every
    # agent in this vault lives on the one board it used to have, so the
    # row's route used to resolve to the page the reader was already on. The
    # panel half is anchored the door scenario's way: the boot came up in a
    # stored conversation NO NODE claims, so the sessions pill afterwards is
    # the panel having MOVED — not the panel happening to be showing the
    # conversation anyway.
    Given I open the outline "backlog.olai"
    Then no agent fold is open
    When I press the agent "door-live"
    Then the sidebar marks the outline "lanes.olai" as the one open
    When I open the session picker
    Then the panel offers a fresh session, saying "memory is the subtree"

  @corpus:lanes
  Scenario: An unbound agent's sidebar press navigates, and says nothing
    Given I open the outline "backlog.olai"
    Then the agent "door-live" stands "asleep"
    When I press the agent "door-implement"
    Then the sidebar marks the outline "lanes.olai" as the one open
    And the agent "door-live" stands "asleep"
    And the agents roster says nothing
    And no agent fold is open

  # ── what the list must not swallow ────────────────────────────────────

  @agent-stored @scratch:lanes
  Scenario: A filed agent's history can be read while its current turn keeps working
    Given I open the outline "lanes.olai"
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I ask the agent "hold"
    Then the agent "filed-chat" stands "working"
    When I open the session picker
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    And the agent "filed-chat" stands "working"
    When I press the agent "filed-chat"
    And the agent is released
    Then the agent is idle
