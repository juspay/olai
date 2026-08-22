Feature: Choosing an agent
  The panel talks to one agent, and which one is a question with an answer per
  conversation. Olai looks for the agents it knows — the ACP adapter it ships
  with, and an `opencode` on its own search path — and what it finds is what you
  can choose between. A conversation is bound to the agent it was created with
  for its life, and the note this directory keeps remembers which, so reopening
  one talks to the agent that has it.

  The scenarios tagged `@opencode` are the ones whose server FINDS an opencode:
  a scripted one shaped the way the real one is on the wire
  (`agent/opencode/opencode`, captured against 1.17.9). Everything else in this
  suite runs with an empty agent search path and a roster of one, which is what
  every olai in the world is running today — and which is why the picker does
  not turn up in front of scenarios that are not about it.

  Background:
    Given I open the app
    And I mark the page
    And the agent panel is open

  @opencode @scratch:chat
  Scenario: A new chat asks which agent
    # The ruling: every new chat asks, and no default is remembered across
    # conversations. So a panel with two agents and no conversation to come
    # back to holds nothing at all until somebody answers — there is no box to
    # type into, because there is nobody to send to.
    Then the panel asks which agent
    And the picker offers the agent "claude"
    And the picker offers the agent "opencode"
    And there is nothing to type into

  @opencode @scratch:chat
  Scenario: The header says who the conversation is with
    # The other half of the ruling: the header shows the agent's icon and name
    # beside the model. A mark as well as a name because the question is one a
    # person answers by looking rather than by reading.
    When I choose the agent "opencode"
    Then the header names the agent "opencode"
    And the header draws that agent's own mark
    And the chat input takes typing

  @scratch:chat
  Scenario: One installed agent is not a choice
    # Every olai before this one. Asking a one-row question is friction with no
    # answer behind it — what a person gets instead is the header saying who
    # they are talking to, which is the part they did not have.
    Then the panel does not ask which agent
    And the header names the agent "claude"

  @opencode @scratch:chat
  Scenario: A turn with opencode, from the box to the answer
    When I choose the agent "opencode"
    And I ask the agent "bash"
    Then the chat eventually shows "ran it"
    And the page has not reloaded
    And there should be no page errors

  @opencode @scratch:chat
  Scenario: A call is named from its id, and keeps that name while the title moves
    # Opencode sends no `_meta` at all, so the only place a tool's programmatic
    # name is said is the head of the call id (`bash:0`). The `title` is not it:
    # this agent rewrites it under the call, the way the real one does, and a
    # panel that read the title would rename the row while somebody was looking
    # at it.
    When I choose the agent "opencode"
    And I ask the agent "bash"
    Then the chat shows a tool call named "bash"
    And the chat shows a completed tool call

  @opencode @scratch:chat
  Scenario: A write through opencode's own tool naming reaches the outline
    # Opencode names an MCP server's tools `<server>_<tool>`, not
    # `mcp__server__tool`. The panel has to recognise `olai_set_done` as one of
    # the tools it handed this session — so no permission form is drawn, the
    # write goes through the real ops layer, and the checkbox in front of a
    # person moves.
    When I choose the agent "opencode"
    And I ask the agent "done order"
    Then the chat eventually shows "marked order done"
    And node "order" is done
    And the chat shows no question
    And the page has not reloaded

  @opencode @scratch:chat
  Scenario: One of olai's own is answered without anybody being asked
    # The same rule at the other door: a permission REQUEST for one of ours is
    # answered here and now — and by the option's own kind rather than by its
    # place in the list, because opencode's options lead with an allow where the
    # other agent's lead with the refusal.
    When I choose the agent "opencode"
    And I ask the agent "permit"
    Then the chat eventually shows "allow_once"
    And the chat shows no question

  @opencode @scratch:chat
  Scenario: A tool nothing named is never approved by failing to recognise it
    # The fail-safe rule, at the one place it can be walked end to end. The call
    # id carries no name, so nothing can say which tool this is — and a tool
    # olai cannot name is one a PERSON is asked about. A rule that widened here
    # would approve somebody's permissions on their behalf.
    When I choose the agent "opencode"
    And I ask the agent "nameless"
    Then the chat shows a question

  @opencode @scratch:chat
  Scenario: The composer says what a mid-turn message will do
    # Opencode has no steering method, so what you type while a turn runs is an
    # ordinary prompt it queues behind that turn. The box still never locks and
    # nothing is held here — what differs is where the words LAND, and a
    # degradation a person can see is one they can work with.
    When I choose the agent "opencode"
    And I ask the agent "slow"
    Then the composer says a message would queue
    When the agent is released
    Then the agent is idle
    And the composer says nothing about queueing

  @opencode @scratch:chat
  Scenario: Starting another chat asks again, and can be backed out of
    # The other door into the same question, and the one difference between
    # them: a person who pressed `+ new` still has the conversation they were
    # in, so a misclick must not be a one-way door into a question. The panel's
    # OWN question has nothing behind it to go back to and offers no such way
    # out.
    When I choose the agent "opencode"
    And I ask the agent "hello"
    Then the chat eventually shows "opencode says: hello"
    When I start a new conversation
    Then the panel asks which agent
    When I keep the conversation I am in
    Then the panel does not ask which agent
    And the header names the agent "opencode"
    And the chat eventually shows "opencode says: hello"
    # ... and answering it starts a conversation with the agent that was picked,
    # which is the whole of "a new chat asks".
    When I start a new conversation
    And I choose the agent "claude"
    Then the header names the agent "claude"
    And the chat is empty

  @opencode @agent-stored @scratch:chat
  Scenario: Reopening the conversation talks to the agent that has it
    # The note beside the session id. A session id means nothing to the other
    # agent — asking it to load one gets a refusal — so the boot has to know
    # which agent this conversation is with before it has one to ask. It comes
    # back without asking again, in the same conversation, on the same agent.
    When I choose the agent "opencode"
    Then the chat eventually shows "opencode remembers this conversation"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the panel does not ask which agent
    And the header names the agent "opencode"
    And the chat eventually shows "opencode remembers this conversation"

  @no-agent @scratch:chat
  Scenario: With no agent at all, the panel says how to get one
    # An empty roster shows install instructions rather than an empty list —
    # the panel answers the question a person actually has, which is what to do
    # about it. Reached the way somebody would reach it deliberately:
    # `OLAI_ACP_AGENT` set to the empty string, which is the whole off switch
    # rather than one missing row.
    Then the panel says there is no agent
    And the panel tells me how to install "opencode"
    And the panel explains how to configure one, naming "OLAI_ACP_AGENT"
    And there is nothing to type into
    # And the outlines are unaffected: serving a directory never depended on an
    # agent being installed.
    And the outline list is shown
