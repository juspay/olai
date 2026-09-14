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

  @opencode @omp @agent-stored @scratch:chat
  Scenario: Every engine's stored conversations are filed with their engine identity
    Then the filer's boot run has settled
    # THREE, and the count is the claim rather than bookkeeping: each engine's
    # filed rows have to carry their OWN identity, so three engines with a stored
    # conversation file three rows — not one engine's rows landing under another
    # engine's name, and not one row standing in for two. It read 2 while this
    # suite had two engines that stored anything; omp is the third, and it is the
    # one that is FOUND on the search path rather than shipped, so its row is
    # also the one no pin could have filed for it.
    And the Inbox has 3 filed conversations
    When I open the filed "opencode" conversation "an opencode conversation" as node "opencode-chat"
    Then the header names the agent "opencode"
    When I open the filed "omp" conversation "an Oh My Pi conversation" as node "omp-chat"
    Then the header names the agent "omp"
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

  @omp @scratch:chat
  Scenario: The node menu offers claude and Oh My Pi
    When I open the node menu of "kitchen"
    # The NAME and not the id, which is worth a scenario rather than a
    # formality because this row is a PROBE: a runnable `omp` on the agent
    # search path is the machine saying it has one, and the sentence a person
    # reads is the plugin's own `NAME` ("Oh My Pi", `src/install.ts`). The two
    # words a menu is built out of are a trap here — the id is `omp`, and the
    # row next along in `olai.yml` is called `pi` outright, which this name ENDS
    # in. `not-a-plugin.json` exists to say out loud that neither branding is
    # that row's; a menu that matched on the id, or read this name as that one,
    # offers the wrong agent exactly where a person cannot tell.
    Then the node menu offers "Start an agent session — Claude Code"
    And the node menu offers "Start an agent session — Oh My Pi"

  @omp @scratch:chat
  Scenario: The header says who the conversation is with
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # TWO WORDS FOR ONE ROW, from two different places, and the header is the
    # half that has to agree with the machine rather than with the menu: the row
    # a person pressed said "Oh My Pi", and what the header names is the id the
    # fiber is bound under (`omp`) — which is also the string every other step
    # in this suite compares, and the key the mark is hung under. A mark table
    # that still held a closed union of three engines would draw somebody
    # else's glyph beside this name.
    Then the header names the agent "omp"
    And the header draws that agent's own mark
    And the chat input takes typing

  @omp @scratch:chat
  Scenario: A turn with omp, from the box to the answer — and its thinking left out
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # THE FIRST ENGINE HERE THAT SENDS `agent_thought_chunk`, which is what makes
    # this a claim: omp narrates its deliberation on the same feed as its prose.
    # `packages/plugins/chat/src/agent.ts` has no case for that update kind, and
    # its default arm drops a whole kind this panel has no view for — on purpose,
    # and it says why there. Two things then follow, and this asserts both ends
    # of them: the scratchpad must not be drawn as speech (a transcript is a
    # conversation, and a model talking to itself is not one), and it must not
    # COUNT as speech either, because the silence arm is fed by the same door —
    # which is how a turn that only thought would come out looking like a turn
    # that had something to say.
    And I ask the agent "hello"
    Then the chat eventually shows "omp says: hello"
    And the chat does not yet show "weighing up hello"
    And the page has not reloaded
    And there should be no page errors

  @omp @scratch:chat
  Scenario: A command row reads the command the first frame minted, and never moves
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # THE OTHER HALF of opencode's scenario: where that agent announces a bare
    # tool name and then rewrites the title under the call (which is why the
    # shape of that row is "picked once"), this mapper's title for a command
    # tool is its `$ <command>` start text from the FIRST frame and it does
    # not move (`acp-event-mapper.ts`'s `buildToolTitle`). With no `_meta`
    # anywhere to read a name off, the row a person reads IS that first title —
    # which is why the id's head is what a permission rule must ask about
    # (the `nameless` scenario below): on this wire the row can say what the
    # call did without ever saying which tool did it.
    And I ask the agent "bash"
    Then the chat shows a tool call named "$ ls"
    And the chat shows a completed tool call

  @omp @scratch:chat
  Scenario: The write through omp's own dispatch door reaches the outline
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # THE DOOR THIS WIRE HAS AND NO OTHER DOES, and the reason "asks nobody" is
    # true here in a stronger sense than on opencode: with omp's default
    # `tools.xdev`, one of olai's tools is never announced as itself. The call is
    # omp's own `write`, and the tool is named only inside `rawInput.path` —
    # `xd://mcp__olai_outlines_done`. Nothing about that path decides a
    # permission (the leg says so where it reads it: display only), and nothing
    # needs to: `--approval-mode yolo` skips omp's ACP gate for everything but
    # bash, edit, delete and move, none of which are olai's tools, so no
    # `session/request_permission` is ever issued for this call at all. What the
    # path DOES buy is the row — and the write still goes through the real ops
    # layer, which is the checkbox in front of a person moving.
    And I ask the agent "done order"
    Then the chat eventually shows "marked order done"
    And node "order" is done
    And the chat shows no question
    And the page has not reloaded

  @omp @scratch:chat
  Scenario: omp's olai write has its title, outline, clickable story and one reply
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # WHAT THE PATH BUYS, walked as one row: because the leg recognises the
    # `xd://mcp__olai_outlines_done` the `write` was dispatched through, this
    # call is drawn as olai's own tool rather than as a file write — the
    # friendly title in place of the model's intent sentence, the outline it
    # touched, a story whose node can be pressed through, and the tool's answer
    # read out of the nesting the `write` wrapped it in
    # (`details.xdev.inner.rawContent`). Nothing else on this wire says the
    # tool's name at all, so the row is the reading.
    When I ask the agent "done order"
    Then the chat shows a tool call named "Mark done"
    And the tool call says which outline it touched
    And the chat says the write "marked done"
    When I press the node "order" in the write
    Then the node "order" is focused
    When I unfold the tool call
    # ... and the reply is asserted ONCE, with no progress line under it: the
    # inner text is parsed and drawn as the tool's own answer, and a row that
    # also showed the wrapping `write`'s raw output would be saying the same
    # thing twice.
    #
    # NOT asserted: the name the call is "called" underneath. On the other legs
    # that name is a tool's programmatic name arriving in a `_meta`; here there
    # is no `_meta` on any frame, and what omp puts in `title` is the intent
    # sentence its model wrote — so a scenario pinning a string there would be
    # pinning another engine's shape onto this wire.
    And the tool call's reply is shown once

  @omp @scratch:chat
  Scenario: omp's olai read has a title and outline with no write story
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # The other half of the reading, and the half that would be wrong if the two
    # tools were read the same way: `outlines_read` changes nothing, so there is
    # no story under the call and nothing for a person to press. The title and
    # the outline are still read — the recognition is about which tool this is,
    # not about what that tool did.
    When I ask the agent "context order"
    Then the chat shows a completed tool call
    And the chat shows a tool call named "Read a node"
    And the tool call says which outline it touched
    And the chat shows no story under the call

  @omp @scratch:chat
  Scenario: A call olai recognises by its path is still a person's question here
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # THE TRAP IN THE DOOR, and the one ruling that is this wire's own rather
    # than every wire's. Olai answers a permission request for one of ITS tools
    # without asking anybody — `allowedWithoutAsking` matches the name the wire
    # gives the call against the servers this session was handed. On this wire
    # the name is `write`: the request's `toolCallId` is `write:0`, and that the
    # call is really `mcp__olai_outlines_add` lives in the `rawInput.path` and
    # nowhere the approval rule looks. So the rule cannot fire, and the request
    # lands on a person — which is the losing direction and the right one: a
    # path is minted by the agent and may be believed for DISPLAY, but an
    # approval read off one would be approving in the model's name. The
    # `tools.xdev: false` shape, whose id head IS the minted `mcp__<server>_…`
    # name, is where this leg's auto-allow is actually reachable; the default
    # shape is here. One honesty note about the witness: the REAL omp never
    # sends this request at all for `write` — its gate's list is
    # `bash`/`edit`/`delete`/`move` — so what is being witnessed on this wire
    # is olai's rule and the person it puts in front of one, not a frame omp
    # was captured sending.
    And I ask the agent "permit"
    Then the chat shows a question
    And the question offers "allow_once"
    When I choose "Allow once"
    And I answer the question
    Then the chat eventually shows "allow_once"

  @omp @scratch:chat
  Scenario: A tool nothing named is never approved by failing to recognise it
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # The fail-safe rule at the one place it can be walked end to end. The call
    # id is `:<n>` — no name half at all — and `toolNameOf` answers `null` for
    # exactly that shape (`at <= 0`), so nothing can say which tool this is. A
    # tool olai cannot name is one a PERSON is asked about; a rule that widened
    # here would be approving somebody's permissions on their behalf, and the
    # branch that answers `null` is all that stands between them.
    And I ask the agent "nameless"
    Then the chat shows a question

  @omp @scratch:chat
  Scenario: The composer promises nothing about a mid-turn message, because a send ends the turn
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # THE ONE ENGINE OLAI TALKS TO WHERE A SEND IS NOT A QUEUE. omp advertises
    # no `promptQueueing`, and it does not need to: a `session/prompt` arriving
    # while a turn streams CANCELS that turn and runs what was just typed. So
    # the composer has nothing true to promise about a message sent mid-turn —
    # nowhere to say "queued behind this one", and no interruption to offer
    # either, because a send already IS one (`_session/steering` is -32603).
    # Both absences are asserted, and then the wire's own answer is: the held
    # turn ends `cancelled` — the same stop reason a person gets from the
    # button, with the notice that goes with it — and the second turn answers.
    And I ask the agent "slow"
    Then the chat shows a running tool call
    And the composer says nothing about queueing
    And the composer offers no interruption
    When I type "hello" into the chat
    And I send the chat message
    Then the chat shows my message "hello"
    And the chat says the turn was cancelled
    And the chat eventually shows "omp says: hello"
    And the agent is idle

  @omp @scratch:chat
  Scenario: Cancel is about the turn in flight, and says so once
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # The scope of the button on a wire that never has two turns to reach. On
    # opencode a cancel is about everything in flight, because a message sent
    # mid-turn is sitting behind the running one; here a send has already
    # replaced the running turn, so the press has exactly one thing to stop and
    # exactly one thing to report. `the chat says it once` is the half that
    # would catch a panel reporting the conversation's history rather than the
    # press — a notice for every turn that ever ended would be a transcript of
    # cancellations.
    And I ask the agent "slow"
    Then the chat shows a running tool call
    When I cancel the turn
    Then the agent is idle
    And the chat says the turn was cancelled
    And the chat says it once

  @omp @scratch:chat
  Scenario: A turn that ends having said nothing says so
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # The same arm the other engines are held to, walked on this wire because the
    # silence arm is generic and this is where a naive renderer would have
    # broken it: omp sends a `usage_update` and then a SUCCESSFUL `end_turn`
    # having produced nothing at all. A lone usage frame is a frame, and it used
    # to be enough to convince the panel the agent had worked on the message —
    # so what a person got back was an empty space under their words and a panel
    # back at ready. The words are the point, and the environment is the trap.
    And I ask the agent "silent"
    Then the chat eventually shows "ended the turn without saying anything"
    And the chat eventually shows "provider key"
    And the panel says something went wrong
    And the agent is idle

  @omp @scratch:chat
  Scenario: An ordinary turn is not accused of silence
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # The other half, without which the arm above is worse than useless: a turn
    # that said anything at all costs nothing to recognise, and the thought
    # chunks are the new hazard on THIS wire — a panel that counted them would
    # have no reason to complain here, and a panel that drew them would. What is
    # asserted is the good answer and the absence of the complaint.
    And I ask the agent "hello"
    Then the agent's answer mentions "omp says: hello"
    And the chat does not yet show "ended the turn without saying anything"
    And the chat says nothing went wrong

  @omp @scratch:chat
  Scenario: The picker offers the ids it reports, under the names it gives them
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # No alias arithmetic on this wire, and that is a claim about both halves of
    # the picker. A model's VALUE is the `provider/id` omp reports, and its
    # display name is the option's own `name` — so the row a person presses says
    # "Claude Sonnet 5" while the string that travels is
    # `anthropic/claude-sonnet-5`, and the header has to name the row rather
    # than the string. The session came up on `litellm/kimi-k3`, so the first
    # assertion is that a `provider/id` this panel has never been told the name
    # of is already on screen as the name its picker gave it.
    Then the panel header names the model "Kimi K3"
    # ...and picking by the DISPLAY name is what proves the list is drawn that
    # way: an exact-name press finds no row at all if the row carries the raw id.
    When I choose the chat model "Claude Sonnet 5"
    # ...and a change comes back as a `config_option_update` carrying the whole
    # set, which is what the header reads — so naming the new label beside the
    # old one is a reading of the update rather than of this tab's optimism.
    Then the panel header names the model "Claude Sonnet 5"

  @omp @scratch:chat
  Scenario: Typing in omp's model menu narrows it by provider
    # The picker's NAMES never say a provider — "Claude Sonnet 5" is not
    # `anthropic/claude-sonnet-5` — so "anthropic" can only match the VALUE,
    # which is what olai will actually send. And the row it narrows to is the
    # row Enter sends: the session came up on `litellm/kimi-k3`.
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    When I open the session settings
    And I filter the chat models by "anthropic"
    Then the model picker offers only "Claude Sonnet 5"
    When I pick the model under the cursor
    Then the panel header names the model "Claude Sonnet 5"
    And the model picker is shut

  @omp @scratch:chat
  Scenario: A message the agent is too busy with its own work to take keeps its words
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # The refusal that is NOT a silence, and the words that must survive it: a
    # prompt arriving while omp is busy with a turn of its OWN (one no client
    # prompt owns) is answered `-32000 session_busy` with a hint naming what to
    # do about it, and nothing else at all arrives — no chunk, no usage frame.
    # A refusal is a certainty, so the row keeps the prompt and says so; a panel
    # that dropped the words here would be taking somebody's message away with
    # the one thing they could do about it.
    And I ask the agent "busy"
    Then the chat shows my message "busy" as "refused"
    And the strip under my message "busy" reads "not sent"
    And the agent is idle
    # ... and the conversation is not wedged: the refusal is about that one
    # message, and the next thing somebody does is type.
    And the chat input takes typing

  @omp @scratch:chat @acp-session-features
  Scenario: Client-owned terminal output streams into a retained row
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    # The same REGION the pi corner feeds, fed the other way on this wire: no
    # `terminal_output` `_meta` ever arrives, because the process being watched
    # is olai's own — spawned by the agent through `terminal/create` (olai
    # advertised `terminal: true`), named on the call's `{type: "terminal"}`
    # block, and drained through `terminal/output` at the end. Two of the lines
    # asserted here are olai's own rendering ("Running", "Exit 0") and two are
    # the command's real bytes — the point being that the first pair can only
    # be true of a process olai is RUNNING, rather than of a transcript an
    # adapter happened to carry.
    And I ask the agent "slow"
    Then terminal output contains "omp command started"
    And terminal output contains "Running"
    When the agent is released
    Then the agent is idle
    And terminal output contains "Exit 0"
    And terminal output contains "omp command started"
    And terminal output contains "omp command done"

  @omp @agent-stored @scratch:chat
  Scenario: Reopening the conversation talks to the agent that has it
    When I open the filed "omp" conversation "an Oh My Pi conversation" as node "filed-engine"
    And the node agent's fold is ready
    # A session id means nothing to the wrong agent — asking one to load it gets a
    # refusal — so the boot has to know which engine this conversation belongs to
    # before it has one to ask. It comes back without asking again, in the same
    # conversation and on the same agent, and the restart is the half that says
    # the note beside the save is what carried it rather than this tab.
    Then the chat eventually shows "omp remembers this conversation"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    And the header names the agent "omp"
    And the chat eventually shows "omp remembers this conversation"

  @omp @agent-stored @scratch:chat
  Scenario: A filed omp conversation carries the count its listing reported
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the filer's boot run has settled
    When I open the filed "omp" conversation "an Oh My Pi conversation" as node "omp-chat"
    # This wire is the one that answers the question the picker's note asks:
    # omp stamps a real `messageCount` on each `session/list` entry, so the filed
    # row can say how long a stored conversation is without opening it — and
    # because it is a count the agent reported rather than one this side
    # inferred, the note can be asserted to the number.
    Then the filed node "omp-chat" has a note containing "21 messages"
    And the header names the agent "omp"
