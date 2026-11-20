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
    Given I open the outline "lanes.olai"
    Then the agents roster holds 9 agents
    And the agents roster lists "door-implement"
    And the agents roster lists "door-review"
    And the agents roster lists "quiet-implement"
    And the agent "door-review" is named "review: grok"

  @corpus:lanes
  Scenario: An unbound agent wears a standing in the aside
    Given I open the outline "lanes.olai"
    Then the aside on "door-implement" stands "unbound"
    And the aside on "door-implement" reads "No agent"
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
    When I return to the conversation's outline
    Then the aside on "door-live" stands "needs-you"
    And the aside on "door-live" reads "Needs you"

  @scratch:good
  Scenario: A directory with no node agent has no Needs you rows
    Given I open the outline "garden.olai"
    Then Needs you is absent
    And the agents roster holds 0 agents

  @scratch:lanes
  Scenario: Starting an agent session on a BARE node is what creates the node agent
    Given I open the outline "lanes.olai"
    Then there is no door on "lane-fresh"
    When I open the node menu of "lane-fresh"
    And I choose "Start an agent" from the node menu
    Then the vault node "lane-fresh" has property "agent-session" holding "claude:fake-session-1"
    And the agents roster holds 10 agents
    And the agents roster lists "lane-fresh"
    And the header names the agent "claude"

  @scratch:lanes
  Scenario: ... and on a node that already names an engine, it uses that one
    Given I open the outline "lanes.olai"
    Then the agent "door-implement" stands "unbound"
    When I open the node menu of "door-implement"
    And I choose "Start an agent" from the node menu
    Then the vault node "door-implement" has property "agent-session" holding "claude:fake-session-1"
    And the header names the agent "claude"
    And the node agent's fold is ready

  @scratch:lanes
  Scenario: ... and the conversation is opened in the node's own scope, not moved into it
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    When the agent refuses to load a conversation
    And I return to the conversation's outline
    And I open the node menu of "lane-fresh"
    And I choose "Start an agent" from the node menu
    Then the vault node "lane-fresh" has property "agent-session" holding "claude:fake-session-1"
    And the agent "lane-fresh" stands "idle"
    And the panel shows no such refusal
    And there is somewhere to type into

  @corpus:lanes
  Scenario: A node agent that already has a session is not offered a new one
    Given I open the outline "lanes.olai"
    When I open the node menu of "door-live"
    Then the node menu does not offer "Start an agent"

  @scratch:lanes
  Scenario: An agent-associated session is taught its contract, once
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    Then the agent "door-live" stands "idle"
    And this conversation's "kolu" wake is on nothing
    And this conversation's "odu" wake is on nothing
    When I ask the agent "what is blocking the connector?"
    Then the agent was told its contract 1 time
    And the contract names "watch the connector" and its subtree
    When I ask the agent "and now?"
    Then the agent was told its contract 1 time
    And the agent's answer mentions "you said: and now?"

  @scratch:lanes
  Scenario: A node agent can write a sibling outside its subtree
    Given I open the outline "lanes.olai"
    And I show the done nodes
    And I press the agent "door-live"
    And the node agent's fold is ready
    Then the agent "door-live" stands "idle"
    When I ask the agent "ready"
    And the agent is idle
    When I ask the agent "done door-review"
    Then the agent is idle
    When I return to the conversation's outline
    And I show the done nodes
    Then the node "door-review" has status "done"
    And the chat shows no refusal

  @scratch:lanes
  Scenario: A node agent may write its own subtree
    Given I open the outline "lanes.olai"
    And I show the done nodes
    And I press the agent "door-live"
    And the node agent's fold is ready
    Then the agent "door-live" stands "idle"
    When I ask the agent "ready"
    And the agent is idle
    When I ask the agent "done door-live"
    Then the agent is idle
    And the chat shows no refusal
    When I return to the conversation's outline
    And I show the done nodes
    Then the node "door-live" has status "done"

  @agent-stored @scratch:lanes
  Scenario: Two node agents converse at once, with both roster rows live
    Given I open the outline "lanes.olai"
    And node "lane-fresh" in "lanes.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "lane-fresh"
    And the node agent's fold is ready
    And I ask the agent "slow"
    Then the agent "lane-fresh" stands "working"
    When I press the agent "door-live"
    Then the agent "lane-fresh" stands "working"
    And the agent "door-live" stands "idle"
    When I ask the agent "the second conversation"
    Then the agent has answered "the second conversation" exactly once
    And the agent "lane-fresh" stands "working"
    When the agent is released

  @scratch:lanes
  Scenario: ... and a restart does not say it again
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
    And the agent has answered "still there?" exactly once
    Then the agent was told its contract 0 times

  @scratch:lanes @remind-every:3
  Scenario: A node agent is reminded of its writing rule on its Nth message, across a restart
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    When I ask the agent "question one"
    Then the agent was told its contract 1 time
    When I ask the agent "question two"
    And the agent has answered "question two" exactly once
    Then the agent was reminded of its writing rule 0 times
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    And I ask the agent "question three"
    And the agent has answered "question three" exactly once
    Then the agent was reminded of its writing rule 1 time
    And the agent was told its contract 0 times
    When I ask the agent "question four"
    And the agent has answered "question four" exactly once
    Then the agent was reminded of its writing rule 1 time

  @scratch:lanes @remind-every:0
  Scenario: A reminder period of 0 never reminds
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    When I ask the agent "question one"
    Then the agent was told its contract 1 time
    When I ask the agent "question two"
    And the agent has answered "question two" exactly once
    And I ask the agent "question three"
    And the agent has answered "question three" exactly once
    Then the agent was reminded of its writing rule 0 times
    And the agent was told its contract 1 time

  @agent-stored @scratch:lanes
  Scenario: A node tied to a stored conversation joins the roster asleep
    Given I open the outline "lanes.olai"
    And node "lane-fresh" in "lanes.olai" is tied to the stored "claude" conversation "the last conversation"
    Then the agents roster holds 10 agents
    And all bound node agents are asleep
    When I press the agent "lane-fresh"
    And the node agent's fold is ready
    Then the panel header names the node agent "a lane nobody has put an agent on"
    When I open the fold history
    Then the past sessions hold "an older conversation"

  @agent-stored @scratch:lanes
  Scenario: Moving a tied node keeps its conversation and history
    Given I open the outline "lanes.olai"
    And node "lane-fresh" in "lanes.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "lane-fresh" in its outline
    And I open the node menu of "lane-fresh"
    And I choose "Move to…" from the node menu
    And I search the move picker for "someday"
    And I choose "someday: where the quiet lane went" from the move picker
    Then the node "lane-fresh" keeps the session "claude:fake-stored-new" in file "backlog.olai"
    When I open the outline "lanes.olai"
    And I press the agent "lane-fresh"
    Then the chat page is about the node "lane-fresh" named "a lane nobody has put an agent on" in "backlog.olai"
    When I open the fold history
    Then the past sessions hold "an older conversation"

  @agent-stored @scratch:lanes
  Scenario: Trashing a tied node takes its agent off the roster, across a restart
    Given I open the outline "lanes.olai"
    And node "lane-fresh" in "lanes.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "lane-fresh" in its outline
    And I open the node menu of "lane-fresh"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then the node "lane-fresh" keeps the session "claude:fake-stored-new" in file "_olai/Trash.olai"
    When the server stops
    And the server starts again on the same port
    And I open the outline "lanes.olai"
    Then the agents roster holds 9 agents

  @corpus:lanes
  Scenario: A node agent's panel offers a fresh session, labelled with what it means
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    Then the agent "door-live" stands "idle"
    When I open the fold history
    Then the panel offers a fresh session, saying "nothing under it yet"
    When I request a fresh session without confirming
    Then the fresh-session confirmation says "The current chat moves to earlier chats."
    When I cancel the fresh session
    Then the fresh-session confirmation is absent

  @agent-stored @scratch:lanes
  Scenario: A node agent whose conversation the engine has lost can still be got out of
    Given I open the outline "lanes.olai"
    When the agent refuses to load a conversation
    And I press the agent "door-live"
    Then the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "no such conversation"
    And the refusal still offers a retry
    And the refusal offers a fresh chat
    And the panel header names the node agent "watch the connector"
    When I open the fold history
    Then the panel offers a fresh session, saying "nothing under it yet"
    When I start a fresh session
    Then the panel shows no such refusal
    And the agent "door-live" stands "idle"
    When I return to the conversation's outline
    Then the vault node "door-live" has property "agent-session" holding "claude:fake-session-1"

  @scratch:lanes
  Scenario: A chat that is not on this machine says so, and one press lands in a working one
    Given the harness keeps distinct sessions on disk
    And I open the outline "lanes.olai"
    When I press the agent "door-live"
    Then the panel says this chat is not on this machine
    When the agent starts so far are counted
    And the refusal is in the agent's own words, "no such conversation"
    And the engine's own words are not alarmed
    And the refusal offers a fresh chat
    And the refusal still offers a retry
    When I start a fresh chat from the refusal
    Then the panel shows no such refusal
    And there is somewhere to type into
    And the agent "door-live" stands "idle"
    When I return to the conversation's outline
    Then the vault node "door-live" has property "agent-session" naming a chat other than "claude:fake-session-1"
    When I reload the page
    And I unfold node agent "door-live"
    And the node agent's fold is ready
    Then the panel shows no such refusal
    And there is somewhere to type into
    And exactly one further agent process has started

  @scratch:lanes
  Scenario: An EARLIER chat the engine cannot find is said plainly, and offers no fresh start
    Given the harness keeps distinct sessions on disk
    And I open the outline "lanes.olai"
    When I press the agent start pill on "lane-fresh"
    And the node agent's fold is ready
    And I ask the agent "the first chat"
    And the agent is idle
    And I remember this conversation as "first"
    When I open the fold history
    And I start a fresh session
    Then the panel has a different conversation from "first"
    When the engine has no record of the chat remembered as "first"
    And I open the fold history
    And I begin opening the past session "the first chat"
    Then the panel says this chat is not on this machine
    And the refusal offers no fresh chat
    And the refusal still offers a retry

  @scratch:lanes
  Scenario: A fresh start the engine refuses says why, and leaves the same face behind
    Given the harness keeps distinct sessions on disk
    And I open the outline "lanes.olai"
    When I press the agent "door-live"
    Then the panel says this chat is not on this machine
    When the agent refuses to new a conversation
    And I start a fresh chat from the refusal
    Then the chat says the click was refused, with "will not start a conversation"
    And the panel says this chat is not on this machine
    And the refusal offers a fresh chat
    And the refusal still offers a retry
    When I reload the page
    And I unfold node agent "door-live"
    Then the panel says this chat is not on this machine
    When I return to the conversation's outline
    Then the vault node "door-live" has property "agent-session" holding "claude:fake-session-1"

  @scratch:lanes
  Scenario: A store that comes back is what Try again is for
    Given the harness keeps distinct sessions on disk
    And I open the outline "lanes.olai"
    When I press the agent start pill on "lane-fresh"
    And the node agent's fold is ready
    And I ask the agent "the only chat"
    And the agent is idle
    And I remember this conversation as "only"
    When the engine has no record of the chat remembered as "only"
    And the server stops
    And the server starts again on the same port
    And I open the app
    And I unfold node agent "lane-fresh"
    Then the panel says this chat is not on this machine
    When the engine finds the chat remembered as "only" again
    And I try to open it again
    Then the panel shows no such refusal
    And the panel is in the remembered conversation "only"

  @scratch:lanes
  Scenario: A fresh chat nobody spoke in is lost to a restart, and is one press out again
    Given the harness keeps distinct sessions on disk
    And I open the outline "lanes.olai"
    When I press the agent "door-live"
    Then the panel says this chat is not on this machine
    When I start a fresh chat from the refusal
    Then the panel shows no such refusal
    When the server stops
    And the server starts again on the same port
    And I open the app
    And I unfold node agent "door-live"
    Then the panel says this chat is not on this machine
    When I start a fresh chat from the refusal
    Then the panel shows no such refusal
    And there is somewhere to type into

  @agent-stored @scratch:lanes
  Scenario: ... and names the conversations this agent has had before this one
    Given I open the outline "lanes.olai"
    And node "lane-fresh" in "lanes.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "lane-fresh"
    And I open the fold history
    Then the panel says this agent has had 1 past session
    And the past sessions hold "an older conversation"

  @agent-stored @scratch:lanes
  Scenario: A node tied to a stored conversation has the session controls immediately
    Given I open the outline "lanes.olai"
    And node "lane-fresh" in "lanes.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "lane-fresh"
    And I open the fold history
    Then the panel offers a fresh session, saying "nothing under it yet"
    And the past sessions hold "an older conversation"

  @codex @scratch:chat
  Scenario: Opening the history lists conversations through the running engine
    Given the harness keeps distinct sessions on disk
    And the listing counter is armed
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I pick "Claude Code" in the "Start an agent" submenu of the node menu
    And I ask the agent "cabinet conversation"
    And the agent is idle
    And a terminal stores a conversation titled "terminal conversation"
    And the agent starts so far are counted
    And the list-asks so far are counted
    When I open the fold history
    Then the list-asks have grown
    And no further agent process has started

  @agent-stored @scratch:lanes
  Scenario: Pressing an agent in the sidebar does BOTH halves of what it means
    Given I open the outline "backlog.olai"
    Then no agent fold is open
    When I press the agent "door-live"
    Then the chat page is about the node "door-live" named "watch the connector" in "lanes.olai"
    And the Chats row "door-live" is current
    When I open the fold history
    Then the panel offers a fresh session, saying "nothing under it yet"

  @scratch:lanes
  Scenario: An unbound agent's sidebar press navigates, and says nothing
    Given I open the outline "backlog.olai"
    Then the agent "door-live" stands "asleep"
    When I press the agent "door-implement"
    Then the chat page is about the node "door-implement" named "implement + open PR" in "lanes.olai"
    And the agent "door-live" stands "asleep"
    And the agents roster says nothing
    And no agent fold is open

  @agent-stored @scratch:lanes
  Scenario: A tied agent's history can be read while its current turn keeps working
    Given I open the outline "lanes.olai"
    And node "lane-fresh" in "lanes.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "lane-fresh"
    And the node agent's fold is ready
    And I ask the agent "hold"
    Then the agent "lane-fresh" stands "working"
    When I open the fold history
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    And the agent "lane-fresh" stands "working"
    When I press the agent "lane-fresh"
