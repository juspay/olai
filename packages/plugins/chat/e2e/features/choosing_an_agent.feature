Feature: Choosing a node agent's engine
  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  @opencode @scratch:chat
  Scenario: The node menu offers claude and opencode
    When I open the node menu of "kitchen"
    Then chat's "Start an agent" in the node menu opens a submenu
    When I open the node menu's "Start an agent" agents
    Then the node menu's "Start an agent" offers the agents "Claude Code|OpenCode"

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
    Then the header names the agent "opencode"
    And the header draws that agent's own mark
    And the chat input takes typing

  @opencode @scratch:chat
  Scenario: An engine that reports no account draws no chip
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    Then the agent line names no account
    And the header names the agent "opencode"

  @scratch:chat
  Scenario: One installed agent is not a choice
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And the header names the agent "claude"

  @opencode @scratch:chat
  Scenario: A turn with opencode, from the box to the answer
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "shell"
    Then the chat eventually shows "ran it"
    And the page has not reloaded
    And there should be no page errors

  @opencode @scratch:chat
  Scenario: A call is named from the frame, and keeps that name while the title moves
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "shell"
    Then the chat shows a tool call named "shell"
    And the chat shows a completed tool call

  @opencode @scratch:chat
  Scenario: A write through opencode's Code Mode reaches the outline
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "done order"
    Then the chat eventually shows "marked order done"
    And node "order" is done
    And the chat shows no question
    And the page has not reloaded

  @opencode @scratch:chat
  Scenario: A script that batches two of olai's calls names both of them
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "batch order"
    Then the chat eventually shows "batched two calls on order"
    And node "order" is done
    And the chat shows a tool call named "Read a node · Mark done"
    And the chat shows no story under the call
    When I unfold the tool call
    Then the tool call is called "execute" underneath
    And the chat shows no question

  @opencode @scratch:chat
  Scenario: One of olai's own is answered without anybody being asked
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "permit kitchen"
    Then the chat eventually shows "once"
    And the chat shows no question

  @opencode @scratch:chat
  Scenario: A script olai did not hand the tools for is never approved for somebody
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "foreign"
    Then the chat shows a question

  @opencode @scratch:chat
  Scenario: A script olai cannot read in full reaches a person even when every tool in it is ours
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "dynamic order"
    Then the chat shows a question
    And node "order" is not done

  @opencode @scratch:chat
  Scenario: A tool nothing named is never approved by failing to recognise it
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "nameless"
    Then the chat shows a question

  @opencode @scratch:chat
  Scenario: The composer offers the interruption and promises no queue
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "slow"
    Then the composer offers an interruption
    And the composer says nothing about queueing
    When the agent is released
    Then the agent is idle
    And the composer offers no interruption

  @opencode @scratch:chat
  Scenario: A message sent mid-turn reaches the turn in flight
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "slow"
    Then the chat shows a running tool call
    When I type "done order" into the chat
    And I send the chat message
    Then the chat shows my message "done order"
    And node "order" is done
    And the agent is working
    And my message "done order" is no longer waiting
    And the chat says how long a running call has been going
    When the agent is released
    Then the chat eventually shows "done dawdling"
    And the agent is idle

  @opencode @scratch:chat
  Scenario: The interrupting gesture is the same door by button and by keyboard
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "slow"
    Then the agent is working
    When I interrupt the agent with "done order" by keyboard
    Then node "order" is done
    And the agent is working
    When the agent is released
    Then the agent is idle

  @opencode @scratch:chat
  Scenario: Cancel is about the turn in flight, and the panel settles
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "slow"
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    And the chat says the turn was cancelled

  @opencode @agent-stored @scratch:chat
  Scenario: Reopening the conversation talks to the agent that has it
    Given node "kitchen" in "house.olai" is tied to the stored "opencode" conversation "an opencode conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
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
    And I ask the agent "silent"
    Then the chat eventually shows "ended the turn without saying anything"
    And the chat eventually shows "provider key"
    And the panel says something went wrong
    And the agent is idle

  @opencode @scratch:chat
  Scenario: An ordinary turn is not accused of silence
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "hello"
    Then the agent's answer mentions "opencode says: hello"
    And the chat does not yet show "ended the turn without saying anything"
    And the chat says nothing went wrong

  @opencode @scratch:chat
  Scenario: A turn somebody stopped is not accused of it either
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "hush"
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
    And I ask the agent "quota"
    Then the chat shows my message "quota" as "refused"
    And the strip under my message "quota" reads "Not sent"
    And the chat eventually shows "Insufficient balance"

  @opencode @scratch:chat
  Scenario: While a turn runs, the panel says so where a person is looking
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "slow"
    Then the panel says it is busy, with "working"
    And the live dot is pulsing
    When the reader asks for less motion
    Then the live dot holds still, and stays lit
    And the panel says it is busy, with "working"
    When the agent is released
    Then the agent is idle
    And the panel does not say it is busy

  @opencode @agent-stored @scratch:chat
  Scenario: A message typed while a stored conversation is opening is delivered once
    Given node "kitchen" in "house.olai" is tied to the stored "opencode" conversation "an opencode conversation"
    When the next conversation load will hang
    And I press the agent "kitchen"
    Then the panel says it is busy, with "Starting"
    When I ask the agent "hello"
    And the agent is released
    Then the agent has answered "opencode says: hello" exactly once
    And the chat shows no refusal

  @opencode @omp @agent-stored @scratch:chat
  Scenario: Every engine's stored conversations are reopened with their own identity
    Given node "kitchen" in "house.olai" is tied to the stored "opencode" conversation "an opencode conversation"
    And node "order" in "house.olai" is tied to the stored "omp" conversation "an Oh My Pi conversation"
    And node "install" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    Then the agents roster holds 3 agents
    When I press the agent "kitchen"
    Then the header names the agent "opencode"
    When I press the agent "order"
    Then the header names the agent "omp"
    When I press the agent "install"
    Then the header names the agent "claude"
    When I open the fold history
    Then the past sessions hold "an older conversation"

  @opencode @agent-stored @scratch:chat
  Scenario: History retains the listing's counts and lineage
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    And I open the fold history
    Then the row for "an older conversation" says it has 47 messages
    And the row for "an older conversation" was superseded by "the last conversation"
    When node "order" in "house.olai" is tied to the stored "opencode" conversation "an opencode conversation"
    And I press the agent "order"
    And the node agent's fold is ready
    And I start a fresh session with "OpenCode"
    And I open the fold history
    Then the row for "an opencode conversation" shows no message count

  @opencode @agent-stored @scratch:chat
  Scenario: History retains its count when the listed successor disappears
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    And the conversation "fake-stored-new" is gone from the agent
    And I open the fold history
    Then the row for "an older conversation" says it has 47 messages
    And the row for "an older conversation" was not superseded

  @opencode @agent-stored @scratch:chat
  Scenario: Picking a conversation of another agent switches the panel to that agent
    Given node "kitchen" in "house.olai" is tied to the stored "opencode" conversation "an opencode conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    Then the header names the agent "opencode"
    When I start a fresh session with "Claude Code"
    Then the header names the agent "claude"
    When I open the fold history
    And I open the past session "an opencode conversation"
    Then the header names the agent "opencode"
    And the opened conversation carries the title "an opencode conversation"
    And the chat input takes typing

  @opencode @agent-stored @scratch:chat
  Scenario: An engine's refused listing leaves other engines' conversations usable
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    And node "order" in "house.olai" is tied to the stored "opencode" conversation "an opencode conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    And I ask the agent "lose"
    Then the chat eventually shows "the conversation store is unreadable"
    When I press the agent "order"
    And the node agent's fold is ready
    Then the header names the agent "opencode"
    And the chat input takes typing

  @pi @scratch:chat
  Scenario: The node menu offers claude and pi
    When I open the node menu of "kitchen"
    Then chat's "Start an agent" in the node menu opens a submenu
    When I open the node menu's "Start an agent" agents
    Then the node menu's "Start an agent" offers the agents "Claude Code|Pi"

  @pi @scratch:chat
  Scenario: A turn with pi, from the box to the answer — and the banner left out
    When I open the "pi" agent on node "kitchen"
    And the node agent's fold is ready
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
    And I ask the agent "silent"
    Then the chat eventually shows "ended the turn without saying anything"
    And the chat does not yet show "pi v0.84.2"
    And the agent is idle

  @pi @scratch:chat
  Scenario: pi works a tool olai handed its conversation
    When I open the "pi" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "mcp read title install"
    Then the chat shows a completed tool call
    And the chat eventually shows "install the cabinets"

  @pi @scratch:chat
  Scenario: A message sent mid-turn to pi queues, with no interruption to offer
    When I open the "pi" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "slow"
    Then the chat shows a running tool call
    And the composer says a message would queue
    And the composer offers no interruption
    When I type "hello" into the chat
    And I send the chat message
    Then the chat shows my message "hello"
    And the chat eventually shows "Queued message (position 1)."
    When the agent is released
    Then the chat eventually shows "done dawdling"
    And the chat eventually shows "pi says: hello"
    And the agent is idle

  @pi @agent-stored @scratch:chat
  Scenario: A pi conversation carries no invented message count
    Given node "kitchen" in "house.olai" is tied to the stored "pi" conversation "a pi conversation"
    And node "order" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    Then the header names the agent "pi"
    When I start a fresh session with "Pi"
    And I open the fold history
    Then the row for "a pi conversation" shows no message count
    When I press the agent "order"
    And the node agent's fold is ready
    Then the header names the agent "claude"

  @pi @agent-stored @scratch:chat
  Scenario: Reopening a stored pi conversation talks to pi
    Given node "kitchen" in "house.olai" is tied to the stored "pi" conversation "a pi conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
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
    And the chat says the write "Done"
    When I press the node "order" in the write
    Then the node "order" is focused
    When I unfold the tool call
    Then the tool call is called "execute" underneath
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

  @opencode @scratch:chat
  Scenario: A Code Mode script that threw is still the row it was
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "throw"
    Then the chat eventually shows "the script gave up"
    And the chat shows a tool call named "execute"
    And the chat shows no question

  @opencode @scratch:chat
  Scenario: An olai call the ops layer refused is still that call, with no reply to draw
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "fail"
    Then the chat eventually shows "could not mark it"
    And the chat shows a tool call named "Mark done"
    And the chat shows no question

  @opencode @scratch:chat
  Scenario: OpenCode's subagents get doors of their own, and the conversation keeps none of their calls
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "agents"
    Then the chat eventually shows "both subagents reported"
    And the agent is idle
    And the conversation carries none of the subagent's calls
    And the chat still shows a call that sent out an "explore"
    When I open the agent's work from the transcript
    Then the agent's work is open, and it is "Survey the kitchen"
    And the agent's work shows 1 calls
    And the open agent's work contains "Survey the kitchen: read" but not "Count the orders"

  @opencode @scratch:chat
  Scenario: A subagent's question is asked in the subagent's name
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "agent-asks"
    Then the chat shows a question
    And the question is drawn in the lane of the agent that asked it
    And the question's lane names itself, as "Open a terminal"
    When I choose "Allow once"
    And I answer the question
    Then the chat eventually shows "the subagent asked and was answered"

  @opencode @scratch:chat
  Scenario: A subagent that ends badly says so, in the word the agent used
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "agent-fails"
    Then the chat eventually shows "both subagents ended badly"
    And the agent is idle
    And the chat shows 4 failed tool calls

  @opencode @scratch:chat
  Scenario: A child of a child stays inside its own parent's work
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "agent-nests"
    Then the chat eventually shows "the nested subagent reported"
    And the conversation carries none of the subagent's calls
    When I open the agent's work from the transcript
    Then the agent's work is open, and it is "Survey the house"
    And the open agent's work contains "Survey the house: read" but not "Count the hinges: shell"
    When I open the nested agent's work
    Then the agent's work is open, and it is "Count the hinges"
    And the agent's work shows 1 calls
    And the open agent's work contains "Count the hinges: shell" but not "Survey the house: read"
    When I return to the parent agent "Survey the house"
    Then the agent's work is open, and it is "Survey the house"

  @opencode @scratch:chat
  Scenario: One of olai's own, called by a SUBAGENT, is answered without asking
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "agent-calls-olai"
    Then the chat eventually shows "the subagent marked it"
    And node "order" is done
    And the chat shows no question
    And the conversation carries none of the subagent's calls
    When I open the agent's work from the transcript
    Then the agent's work is open, and it is "Mark the order"
    And the open agent's work contains "Mark done" but not "opencode says"

  @opencode @scratch:chat
  Scenario: Cancel lands with an agent still out
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "agents-slow"
    Then the agent is working
    And the strip lists 2 agents still out
    When I cancel the turn
    Then the agent is idle
    And the strip lists no agent still out
    And the chat says the turn was cancelled

  @opencode @scratch:chat
  Scenario: A steer that lost the race is sent again, and heard once
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "deaf"
    Then the agent is working
    When I type "hello" into the chat
    And I send the chat message
    Then the agent has answered "opencode says: hello" exactly once
    And the agent is idle
    And the chat shows no refusal

  @opencode @agent-stored @scratch:chat
  Scenario: A reopened conversation keeps the spawning row and no lane
    Given node "kitchen" in "house.olai" is tied to the stored "opencode" conversation "an opencode conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    Then the chat eventually shows "opencode remembers this conversation"
    And the chat shows a tool call named "subagent"
    And the call that spawned it offers no door yet

  @pi @scratch:chat
  Scenario: Pi's olai write has its title, outline, clickable story and one reply
    When I open the "pi" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "mcp done order"
    Then the chat shows a tool call named "Mark done"
    And the tool call says which outline it touched
    And the chat says the write "Done"
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
    Then chat's "Start an agent" in the node menu opens a submenu
    When I open the node menu's "Start an agent" agents
    Then the node menu's "Start an agent" offers the agents "Claude Code|Oh My Pi"

  @omp @scratch:chat
  Scenario: The header says who the conversation is with
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    Then the header names the agent "omp"
    And the header draws that agent's own mark
    And the chat input takes typing

  @omp @scratch:chat
  Scenario: A turn with omp, from the box to the answer — and its thinking left out
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "hello"
    Then the chat eventually shows "omp says: hello"
    And the chat does not yet show "weighing up hello"
    And the page has not reloaded
    And there should be no page errors

  @omp @scratch:chat
  Scenario: A command row reads the command the first frame minted, and never moves
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "bash"
    Then the chat shows a tool call named "$ ls"
    And the chat shows a completed tool call

  @omp @scratch:chat
  Scenario: The write through omp's own dispatch door reaches the outline
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "done order"
    Then the chat eventually shows "marked order done"
    And node "order" is done
    And the chat shows no question
    And the page has not reloaded

  @omp @scratch:chat
  Scenario: omp's olai write has its title, outline, clickable story and one reply
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "done order"
    Then the chat shows a tool call named "Mark done"
    And the tool call says which outline it touched
    And the chat says the write "Done"
    When I press the node "order" in the write
    Then the node "order" is focused
    When I unfold the tool call
    And the tool call's reply is shown once

  @omp @scratch:chat
  Scenario: omp's olai read has a title and outline with no write story
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "context order"
    Then the chat shows a completed tool call
    And the chat shows a tool call named "Read a node"
    And the tool call says which outline it touched
    And the chat shows no story under the call

  @omp @scratch:chat
  Scenario: A call olai recognises by its path is still a person's question here
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
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
    And I ask the agent "nameless"
    Then the chat shows a question

  @omp @scratch:chat
  Scenario: The composer promises nothing about a mid-turn message, because a send ends the turn
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
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
    And I ask the agent "silent"
    Then the chat eventually shows "ended the turn without saying anything"
    And the chat eventually shows "provider key"
    And the panel says something went wrong
    And the agent is idle

  @omp @scratch:chat
  Scenario: An ordinary turn is not accused of silence
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "hello"
    Then the agent's answer mentions "omp says: hello"
    And the chat does not yet show "ended the turn without saying anything"
    And the chat says nothing went wrong

  @omp @scratch:chat
  Scenario: The picker offers the ids it reports, under the names it gives them
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    Then the panel header names the model "Kimi K3"
    When I choose the chat model "Claude Sonnet 5"
    Then the panel header names the model "Claude Sonnet 5"

  @omp @scratch:chat
  Scenario: Typing in omp's model menu narrows it by provider
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    When I open the session settings
    And I filter the chat models by "anthropic"
    Then the model picker offers only "Claude Sonnet 5"
    When I pick the model under the cursor
    Then the panel header names the model "Claude Sonnet 5"
    And the caret is back on the model picker
    And the model picker is shut

  @omp @scratch:chat
  Scenario: Arrows scroll a long model list to keep the row under the cursor on screen
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    When I open the session settings
    And I press "ArrowDown" 20 times in the model filter
    Then the model list has scrolled to the row under the cursor
    When I press "ArrowUp" 20 times in the model filter
    Then the model list is back at the top
    When I press "ArrowUp" in the model filter
    Then the model list has scrolled to the row under the cursor

  @omp @scratch:chat
  Scenario: A message the agent is too busy with its own work to take keeps its words
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "busy"
    Then the chat shows my message "busy" as "refused"
    And the strip under my message "busy" reads "Not sent"
    And the agent is idle
    And the chat input takes typing

  @omp @scratch:chat @acp-session-features
  Scenario: Client-owned terminal output streams into a retained row
    When I open the "Oh My Pi" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "slow"
    Then terminal output contains "omp command started"
    And terminal output contains "Running"
    When I mark the terminal output element
    And the agent is released
    Then the agent is idle
    And terminal output contains "Exit 0"
    And terminal output contains "omp command started"
    And terminal output contains "omp command done"
    And the terminal output keeps its element

  @omp @agent-stored @scratch:chat
  Scenario: Reopening the conversation talks to the agent that has it
    Given node "kitchen" in "house.olai" is tied to the stored "omp" conversation "an Oh My Pi conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    Then the chat eventually shows "omp remembers this conversation"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    And the header names the agent "omp"
    And the chat eventually shows "omp remembers this conversation"

  @omp @agent-stored @scratch:chat
  Scenario: An omp conversation carries the count its listing reported
    Given node "kitchen" in "house.olai" is tied to the stored "omp" conversation "an Oh My Pi conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    Then the header names the agent "omp"
    When I start a fresh session with "Oh My Pi"
    And I open the fold history
    Then the row for "an Oh My Pi conversation" says it has 21 messages
