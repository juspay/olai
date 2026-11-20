Feature: The outline and the chat point at each other
  A row can hand the agent the node it stands for, and what the agent says
  back can hand the reader the row. Both directions name the same thing — an
  id — because that is the one handle every olai tool takes and the one
  spelling that survives a retitle.

  What the first half has to prove is not that a chip appeared: it is that the
  node reached the AGENT, in a form it can act on. So the scripted agent reads
  the id out of its own prompt, calls `outlines_read` with it and says the title
  that came back — a sentence no spelling of the prompt that lost the node
  could produce.

  Every scenario here is `@scratch:chat` — the agent writes, so the directory
  is a private copy with a server of its own.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I open the outline "house.olai"
    And I mark the page
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  @scratch:chat
  Scenario: A row arms the composer, and the turn carries the node
    When I drop row "order" into the conversation
    Then the composer is armed with "order"
    When I ask the agent "context"
    Then the agent's answer says "order is the node titled order the new cabinets"
    And the message was about "order"
    And the composer is armed with nothing

  @scratch:chat
  Scenario: An armed node can be taken off before the message goes
    When I drop row "order" into the conversation
    Then the composer is armed with "order"
    When I take the armed node "order" off
    Then the composer is armed with nothing
    When I ask the agent "context"
    Then the agent's answer says "no node in context"

  @scratch:chat
  Scenario: The node an olai write was about is one press away
    When I ask the agent "done order"
    Then the chat says the write "Done"
    When I press the node "order" in the write
    Then the node "order" is focused
    And the address is "/house.olai"

  @scratch:chat
  Scenario: An id the agent named in its own prose is a reference, and nothing else is
    When I ask the agent "done order"
    Then the agent's answer names the node "order"
    When I press the node "order" in the answer
    Then the node "order" is focused
    And the address is "/house.olai"
    When I ask the agent "edit"
    Then the agent's answer says "rewrote notes.md"
    But the agent's answer does not make "notes.md" a reference

  @scratch:chat
  Scenario: An armed node that has gone refuses the send rather than losing the subject
    When I drop row "order" into the conversation
    Then the composer is armed with "order"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","custom":{"chat-agent-session":"claude:fake-session-1"}}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}
      {"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","doing":"2026-08-02"}
      """
    Then the node "order" is not shown
    When I ask the agent "context"
    Then the chat shows a refusal
    And the composer is armed with "order"

  @scratch:chat
  Scenario: A node that is not on the page is landed at its own row
    When I collapse the node "install"
    And I ask the agent "done hinges"
    And I press the node "hinges" in the write
    Then the address is "/house.olai#hinges"
    And the node "install" is expanded
    And the node "hinges" is focused

  @scratch:chat
  Scenario: A node its own write hid lands the reader on it anyway — revealed, the pick untouched
    Given I hand the page's Done pick back to the panel
    When I ask the agent "done order"
    And I press the node "order" in the write
    Then the address is "/house.olai#order"
    And the node "order" is focused
    And the node "demo" is not shown
    And this page's Done flip says "hidden"
    And the Done flip is the panel's answer
    And there should be no page errors

  @scratch:chat
  Scenario: The next landing's row is revealed in turn, and the reveal goes with the page
    Given I hand the page's Done pick back to the panel
    When I ask the agent "done order"
    And I ask the agent "done hinges"
    And I press the node "order" in the write
    Then the node "order" is focused
    And the node "order" is shown
    When I press the node "hinges" in the write
    Then the node "hinges" is focused
    And the node "order" is not shown
    When I click the outline "yard.olai"
    And I click the outline "house.olai"
    Then the node "order" is not shown
    And the node "hinges" is not shown
    And there should be no page errors

  @scratch:chat
  Scenario: A node in another outline lands the reader on that outline
    When I ask the agent "done fence"
    And I press the node "fence" in the write
    Then the address is "/yard.olai#fence"
    And I show the done nodes

  @scratch:chat
  Scenario: A node that has gone since the write was drawn leaves the page exactly as it was
    When I ask the agent "done install"
    And I press the node "install" in the write
    Then the node "install" is focused
    When I ask the agent "done order"
    Then the agent's answer names the node "order"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","custom":{"chat-agent-session":"claude:fake-session-1"}}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}
      {"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","doing":"2026-08-02"}
      """
    Then the node "order" is not shown
    When I press the node "order" in the answer
    Then the address is "/house.olai"
    And the node "install" is focused

  @scratch:chat @wire
  Scenario: Typing beside an armed chip does not ask again what the node is called
    When I mark the wire
    And I drop row "order" into the conversation
    Then the composer is armed with "order"
    And the initial armed-node lookup has been sent
    When I mark the wire
    And I type "what about the cabinets" into the chat a letter at a time
    Then the chat input reads "what about the cabinets"
    And the tab has asked what the armed nodes are called 0 times
    And the composer is armed with "order"
