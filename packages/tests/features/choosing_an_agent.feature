Feature: Choosing a node agent's engine
  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  @opencode @scratch:chat
  Scenario: The node menu offers claude and opencode
    When I open the node menu of "kitchen"
    Then the node menu offers "Start an agent session — Claude Code"
    And the node menu offers "Start an agent session — opencode"

  @opencode @scratch:chat
  Scenario: An agent this machine no longer has is not a conversation to wedge on
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I remember this conversation as "opencode kitchen"
    And I ask the agent "hello"
    Then the chat eventually shows "opencode says: hello"
    When opencode is no longer installed
    And the server stops
    And the server starts again on the same port
    And I open the app
    Then node agent "kitchen" is folded
    And node "kitchen" still binds remembered conversation "opencode kitchen" in "house.olai"
    When I open the "claude" agent on node "order"
    And the node agent's fold is ready
    Then the header names the agent "claude"
    And the chat input takes typing

  @opencode @scratch:chat
  Scenario: The header says who the conversation is with
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # The other half of the ruling: the header shows the agent's icon and name
    # beside the model. A mark as well as a name because the question is one a
    # person answers by looking rather than by reading.
    Then the header names the agent "opencode"
    And the header draws that agent's own mark
    And the chat input takes typing

  @scratch:chat
  Scenario: One installed agent is not a choice
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    # Every olai before this one. Asking a one-row question is friction with no
    # answer behind it — what a person gets instead is the header saying who
    # they are talking to, which is the part they did not have.
    And the header names the agent "claude"

  @opencode @scratch:chat
  Scenario: A turn with opencode, from the box to the answer
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "bash"
    Then the chat eventually shows "ran it"
    And the page has not reloaded
    And there should be no page errors

  @opencode @scratch:chat
  Scenario: A call is named from its id, and keeps that name while the title moves
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # Opencode sends no `_meta` at all, so the only place a tool's programmatic
    # name is said is the head of the call id (`bash:0`). The `title` is not it:
    # this agent rewrites it under the call, the way the real one does, and a
    # panel that read the title would rename the row while somebody was looking
    # at it.
    And I ask the agent "bash"
    Then the chat shows a tool call named "bash"
    And the chat shows a completed tool call

  @opencode @scratch:chat
  Scenario: A write through opencode's own tool naming reaches the outline
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # Opencode names an MCP server's tools `<server>_<tool>`, not
    # `mcp__server__tool`. The panel has to recognise `olai_outlines_done` as one of
    # the tools it handed this session — so no permission form is drawn, the
    # write goes through the real ops layer, and the checkbox in front of a
    # person moves.
    And I ask the agent "done order"
    Then the chat eventually shows "marked order done"
    And node "order" is done
    And the chat shows no question
    And the page has not reloaded

  @opencode @scratch:chat
  Scenario: One of olai's own is answered without anybody being asked
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # The same rule at the other door: a permission REQUEST for one of ours is
    # answered here and now — and by the option's own kind rather than by its
    # place in the list, because opencode's options lead with an allow where the
    # other agent's lead with the refusal.
    And I ask the agent "permit"
    Then the chat eventually shows "allow_once"
    And the chat shows no question

  @opencode @scratch:chat
  Scenario: A tool nothing named is never approved by failing to recognise it
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # The fail-safe rule, at the one place it can be walked end to end. The call
    # id carries no name, so nothing can say which tool this is — and a tool
    # olai cannot name is one a PERSON is asked about. A rule that widened here
    # would approve somebody's permissions on their behalf.
    And I ask the agent "nameless"
    Then the chat shows a question

  @opencode @scratch:chat
  Scenario: The composer says what a mid-turn message will do
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # What you type while a turn runs is an ordinary prompt opencode queues
    # behind that turn — which since `compact-lost-to-steer` is what a mid-turn
    # message is on EVERY agent olai talks to. This leg was the odd one out and
    # is the one the other converged on, so the line is a promise now rather
    # than a warning about a degradation.
    #
    # And opencode still has no steering method, so it is the leg with one
    # gesture where the other has two: nothing here offers an interruption.
    And I ask the agent "slow"
    Then the composer says a message would queue
    And the composer offers no interruption
    When the agent is released
    Then the agent is idle
    And the composer says nothing about queueing

  @opencode @scratch:chat
  Scenario: A message sent mid-turn goes out at once and is reached in its turn
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # What the composer's line is ABOUT, walked end to end. Nothing is held on
    # this side — the words are on screen the moment they are sent — and the
    # agent reaches them when the turn they were sent into is over. Until then
    # the panel is working, because it is: two turns this server owns, and
    # neither has finished.
    And I ask the agent "slow"
    Then the chat shows a running tool call
    When I type "hello" into the chat
    And I send the chat message
    Then the chat shows my message "hello"
    And the agent is working
    And the chat has not answered "opencode says: hello"
    # ... and the call the FIRST turn is still making is still running. A turn
    # that starts beside another must not mark the other's calls abandoned:
    # they are live, and a clock that stopped here would be the panel saying a
    # running call had been walked away from.
    And the chat says how long a running call has been going
    When the agent is released
    Then the chat eventually shows "done dawdling"
    And the chat eventually shows "opencode says: hello"
    And the agent is idle

  @opencode @scratch:chat
  Scenario: The panel settles when the LAST turn ends, not the first
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # Two held turns, one behind the other. The first ending is not the
    # conversation ending — a panel that went idle there would be reporting a
    # state it can see it is not in, over a turn still doing work.
    And I ask the agent "slow"
    And I ask the agent "slow"
    Then the chat shows a running tool call
    When the agent is released
    Then the chat eventually shows "done dawdling"
    And the agent is working
    When the agent is released
    Then the agent is idle

  @opencode @scratch:chat
  Scenario: Cancel is about everything in flight, not the newest of it
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # A person pressing cancel means the things they have going. With a message
    # queued behind the running turn there are two, and both end — the panel
    # settles rather than sitting at "working" over a turn nobody will ever
    # hear from.
    And I ask the agent "slow"
    And I type "hello" into the chat
    And I send the chat message
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    And the chat says the turn was cancelled
    And the chat has not answered "opencode says: hello"

  @opencode @agent-stored @scratch:chat
  Scenario: Reopening the conversation talks to the agent that has it
    When I open the filed "opencode" conversation "an opencode conversation" as node "filed-engine"
    And the node agent's fold is ready
    # The note beside the session id. A session id means nothing to the other
    # agent — asking it to load one gets a refusal — so the boot has to know
    # which agent this conversation is with before it has one to ask. It comes
    # back without asking again, in the same conversation, on the same agent.
    Then the chat eventually shows "opencode remembers this conversation"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    And the header names the agent "opencode"
    And the chat eventually shows "opencode remembers this conversation"

  @no-agent @scratch:chat
  Scenario: With no available engine, the outline remains usable without agent controls
    Then the agent start pill on "kitchen" is absent
    And no agent fold is open
    And the outline list is shown

  @rows:vault,olai,chat,odu,ws,web-app,mcp,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,outlines,markdown,files,pins,capture,trash,vault-plugins @scratch:chat
  Scenario: With no enabled engine, the outline remains usable without agent controls
    Then the agent start pill on "kitchen" is absent
    And no agent fold is open
    And the outline list is shown

  @opencode @scratch:chat
  Scenario: A turn that ends having said nothing says so
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # THE AUTH FAILURE, and the reason it needed a scenario rather than a unit
    # test: nothing about it is an error. opencode with a provider key it cannot
    # resolve takes the prompt, sends one zero-token usage report and answers
    # `end_turn` — successfully. Every layer between the wire and the panel was
    # working exactly as designed, and what a person got for their message was
    # an empty space under it and a panel back at ready.
    And I ask the agent "silent"
    # THE CLAIM: the turn is accounted for. The words are the point — a person
    # reading this has to be told where to look, and the environment is the
    # trap (an agent olai spawns inherits olai's, not a login shell's).
    Then the chat eventually shows "ended the turn without saying anything"
    And the chat eventually shows "provider key"
    # ... and the banner is still up, unlike every other way a turn ends. A
    # notice scrolls with the transcript, and the next thing somebody does is
    # send again.
    And the panel says something went wrong
    And the agent is idle

  @opencode @scratch:chat
  Scenario: An ordinary turn is not accused of silence
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # The other half, and the one that would make the arm above useless: it
    # costs a turn that said anything at all nothing, and a panel that
    # complained after every answer would be a panel nobody reads.
    And I ask the agent "hello"
    Then the agent's answer mentions "opencode says: hello"
    And the chat does not yet show "ended the turn without saying anything"
    And the chat says nothing went wrong

  @opencode @scratch:chat
  Scenario: A turn somebody stopped is not accused of it either
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # A cancelled turn has a notice of its own. Blaming the agent for obeying
    # would be the panel arguing with the person who pressed the button.
    #
    # `hush` rather than `slow`, and that is the whole of what this pins: a
    # held turn that has ANNOUNCED something is a turn the silence arm would
    # skip anyway, so cancelling one asserts the outcome without reaching the
    # arm. This turn says nothing at all, so the cancel lands with the count
    # untouched — which is the ordinary case (a person stops a turn before it
    # has produced anything) and the one place the early return is the only
    # thing standing between them and being told the agent went quiet on them.
    And I ask the agent "hush"
    # The only thing there IS to wait for, which is the point.
    Then the panel says it is busy, with "working"
    When I cancel the turn
    And the agent is released
    Then the chat says the turn was cancelled
    And the chat does not yet show "ended the turn without saying anything"
    And the agent is idle

  @opencode @scratch:chat
  Scenario: A turn that failed after a usage frame is a message that did not land
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # The other half of the split, and the half that has no face of its own: a
    # usage report is not something a person can SEE, so a turn that sends one
    # and then refuses has produced nothing — the words did not land, and the
    # row has to say so and offer them again. The old single count read that
    # frame as the agent having worked on the message and left it looking sent.
    And I ask the agent "error-silent"
    Then the chat shows my message "error-silent" as "refused"
    And the strip under my message "error-silent" reads "not sent"
    # ... and it is the REFUSAL a person is told about, not a silence: the agent
    # answered, in its own words.
    And the chat eventually shows "No api key passed in"

  @opencode @scratch:chat
  Scenario: While a turn runs, the panel says so where a person is looking
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # The header has said this in small mono chrome beside the model for a
    # while, and it was not enough: the reader has just pressed enter, so their
    # eye is at the bottom of the panel. This is the line under their own
    # message.
    And I ask the agent "slow"
    Then the panel says it is busy, with "working"
    # ... and it goes away, which is the other half of a cue being a cue.
    When the agent is released
    Then the agent is idle
    And the panel does not say it is busy

  @opencode @agent-stored @scratch:chat
  Scenario: A message typed while a filed agent is opening is delivered once
    When the next conversation load will hang
    And I open the filed "opencode" conversation "an opencode conversation" as node "opening-chat"
    Then the panel says it is busy, with "starting"
    When I ask the agent "hello"
    And the agent is released
    Then the agent has answered "opencode says: hello" exactly once
    And the chat shows no refusal

  @opencode @agent-stored @scratch:chat
  Scenario: Every engine's stored conversations are filed with their engine identity
    Then the filer's boot run has settled
    And the Inbox has 2 filed conversations
    When I open the filed "opencode" conversation "an opencode conversation" as node "opencode-chat"
    Then the header names the agent "opencode"
    When I open the filed conversation "the last conversation" as node "claude-chat"
    Then the header names the agent "claude"
    When I open the fold history
    Then the past sessions hold "an older conversation"

  @opencode @agent-stored @scratch:chat
  Scenario: Filed notes and history retain the listing's counts and lineage
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I open the filed conversation "the last conversation" as node "filed-chat"
    Then the filed node "filed-chat" has a note containing "1 messages"
    When I open the fold history
    Then the row for "an older conversation" says it has 47 messages
    And the row for "an older conversation" was superseded by "the last conversation"
    When I open the filed "opencode" conversation "an opencode conversation" as node "opencode-chat"
    Then the filed node "opencode-chat" has no message count in its note

  @opencode @agent-stored @scratch:chat
  Scenario: History retains its count when the listed successor disappears
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And the conversation "fake-stored-new" is gone from the agent
    And I open the fold history
    Then the row for "an older conversation" says it has 47 messages
    And the row for "an older conversation" was not superseded

  @opencode @agent-stored @scratch:chat
  Scenario: Picking another agent's conversation switches the panel to that agent
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    # The consequence of the list spanning both: a row in it may belong to the
    # agent this panel is NOT talking to, and a session id means nothing to the
    # wrong agent. So opening it is a change of agent as well as of
    # conversation — the same change + new makes, through the same door.
    Then the header names the agent "opencode"
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I open the fold history
    And I open the past session "an older conversation"
    Then the header names the agent "claude"
    And the opened conversation carries the title "an older conversation"
    And the chat input takes typing

  @agent-stored @scratch:chat
  Scenario: A single engine's filed node owns its history
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I open the fold history
    Then the past sessions hold "an older conversation"
    And the Unassigned row and list are absent

  @opencode @agent-stored @scratch:chat
  Scenario: An engine's refused listing leaves other engines' filed rows usable
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And I ask the agent "lose"
    Then the filer log names "claude" with "the conversation store is unreadable"
    When I open the filed "opencode" conversation "an opencode conversation" as node "opencode-chat"
    Then the header names the agent "opencode"
    And the chat input takes typing

  @pi @scratch:chat
  Scenario: The node menu offers claude and pi
    When I open the node menu of "kitchen"
    Then the node menu offers "Start an agent session — Claude Code"
    And the node menu offers "Start an agent session — pi"

  @pi @scratch:chat
  Scenario: A turn with pi, from the box to the answer — and the banner left out
    When I open the "pi" agent on node "kitchen"
    And the node agent's fold is ready
    # pi-acp 0.0.33 opens a session by DOUBLING its editor-targeted startup
    # banner as an ordinary agent chunk (the `session/new` answer's
    # `_meta.piAcp.startupInfo` carries the exact string). Olai drops the
    # double, matched on the answer's own text: a transcript is a
    # conversation, this is not one, and the banner is also the one chunk
    # that could make a genuinely silent first turn look said.
    Then the header names the agent "pi"
    And the header draws that agent's own mark
    When I ask the agent "hello"
    Then the chat eventually shows "pi says: hello"
    And the chat does not yet show "pi v0.84.2"
    And the page has not reloaded

  @pi @scratch:chat
  Scenario: A silent turn behind the banner is still named
    When I open the "pi" agent on node "kitchen"
    And the node agent's fold is ready
    # The failure the banner-drop has to NOT make: pi-acp maps a model error
    # to a plain `end_turn` and sends nothing — no prose, no tool, not even
    # usage — so olai's silence arm is the whole of what a person gets. The
    # banner chunk, drawn as speech, would have counted as something said and
    # the arm would never fire on a conversation's FIRST turn, which is when
    # an unconfigured provider fails.
    And I ask the agent "silent"
    Then the chat eventually shows "ended the turn without saying anything"
    And the chat does not yet show "pi v0.84.2"
    And the agent is idle

  @pi @scratch:chat
  Scenario: pi works a tool olai handed its conversation
    When I open the "pi" agent on node "kitchen"
    And the node agent's fold is ready
    # THE PIN'S BRIDGE, answered: pi-acp (0.0.33) stores the session's
    # handed mcpServers and wires them nowhere — the pin patches its
    # `session/new` spawn into `-e <bridge>` + the servers in the process
    # env (packages/plugins/pi/acp/patches/README.md's pi-mcp-servers section), and the bridge
    # registers them on pi's own extension API under the SAME names this
    # surface already reads. The scenario mirrors the wire the patch mints:
    # an `olai_outlines_read:0` call — pending, in_progress, completed, with
    # the tool's answer riding its card. The round trip that is protocol-
    # true lives down in packages/plugins/pi/acp/mcp-bridge/roundtrip.test.js, one SDK pair
    # away from the real servers.
    And I ask the agent "mcp read title install"
    Then the chat shows a completed tool call
    And the chat eventually shows "install the cabinets"

  @pi @scratch:chat
  Scenario: A message sent mid-turn to pi queues, with no interruption to offer
    When I open the "pi" agent on node "kitchen"
    And the node agent's fold is ready
    # The one YES pi-acp earns not by advertisement but by the wire (the
    # spike): a prompt sent while a turn runs is held in the adapter's own
    # queue and answered in order. There is no steering extension —
    # `_session/steering` is -32601, and `/steering` in this adapter is a
    # slash command about pi's own delivery mode — so the gesture the claude
    # agent has is simply not drawn.
    And I ask the agent "slow"
    Then the chat shows a running tool call
    And the composer says a message would queue
    And the composer offers no interruption
    When I type "hello" into the chat
    And I send the chat message
    Then the chat shows my message "hello"
    # ... and the wire's own answer to the queued message is what the panel
    # shows: the adapter's queue-announce chunk, spoken as speech where a
    # client shows speech. The composer claim above is the leg's word; this
    # line is the frames the word was the reading of.
    And the chat eventually shows "Queued message (position 1)."
    When the agent is released
    Then the chat eventually shows "done dawdling"
    And the chat eventually shows "pi says: hello"
    And the agent is idle

  @pi @agent-stored @scratch:chat
  Scenario: A filed pi conversation carries no invented message count
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the filer's boot run has settled
    And the Inbox has 2 filed conversations
    When I open the filed "pi" conversation "a pi conversation" as node "pi-chat"
    Then the filed node "pi-chat" has no message count in its note
    And the header names the agent "pi"
    When I open the filed conversation "the last conversation" as node "claude-chat"
    Then the header names the agent "claude"

  @pi @agent-stored @scratch:chat
  Scenario: Reopening a stored pi conversation talks to pi
    When I open the filed "pi" conversation "a pi conversation" as node "filed-engine"
    And the node agent's fold is ready
    # `session/load` is the adapter's own session map reattaching a fresh pi
    # to the stored file; the replays are the conversation, and the note is
    # how the boot comes back without asking.
    Then the chat eventually shows "pi remembers this conversation"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    And the header names the agent "pi"
    And the chat eventually shows "pi remembers this conversation"

  @pi @scratch:chat @acp-session-features
  Scenario: Adapter-owned terminal metadata streams into a retained tool output
    When I open the "pi" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "slow"
    Then terminal output contains "pi command started"
    And terminal output contains "Running"
    When the agent is released
    Then the agent is idle
    And terminal output contains "Exit 0"
    And terminal output contains "pi command started"
    And terminal output contains "(no output)"

  @opencode @scratch:chat
  Scenario: OpenCode's olai write has its title, outline, clickable story and one reply
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "done order"
    Then the chat shows a tool call named "Mark done"
    And the tool call says which outline it touched
    And the chat says the write "marked done"
    When I press the node "order" in the write
    Then the node "order" is focused
    When I unfold the tool call
    Then the tool call is called "olai_outlines_done" underneath
    And the tool call's reply is shown once

  @opencode @scratch:chat
  Scenario: OpenCode's olai read has a title and outline with no write story
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "context order"
    Then the chat shows a completed tool call
    And the chat shows a tool call named "Read a node"
    And the tool call says which outline it touched
    And the chat shows no story under the call

  @pi @scratch:chat
  Scenario: Pi's olai write has its title, outline, clickable story and one reply
    When I open the "pi" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "mcp done order"
    Then the chat shows a tool call named "Mark done"
    And the tool call says which outline it touched
    And the chat says the write "marked done"
    When I press the node "order" in the write
    Then the node "order" is focused
    When I unfold the tool call
    Then the tool call is called "olai: outlines_done" underneath
    And the tool call's reply is shown once

  @pi @scratch:chat
  Scenario: Pi's olai read has a title and outline with no write story
    When I open the "pi" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "mcp read title order"
    Then the chat shows a completed tool call
    And the chat shows a tool call named "Read a node"
    And the tool call says which outline it touched
    And the chat shows no story under the call
