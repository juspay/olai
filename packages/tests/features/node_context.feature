Feature: The outline and the chat point at each other
  A row can hand the agent the node it stands for, and what the agent says
  back can hand the reader the row. Both directions name the same thing — an
  id — because that is the one handle every olai tool takes and the one
  spelling that survives a retitle.

  What the first half has to prove is not that a chip appeared: it is that the
  node reached the AGENT, in a form it can act on. So the scripted agent reads
  the id out of its own prompt, calls `read_node` with it and says the title
  that came back — a sentence no spelling of the prompt that lost the node
  could produce.

  Every scenario here is `@scratch:chat` — the agent writes, so the directory
  is a private copy with a server of its own.

  Background:
    Given I open the outline "house.olai"
    And I mark the page
    And the agent panel is open

  @scratch:chat
  Scenario: A row arms the composer, and the turn carries the node
    When I open the node menu of "order"
    And I choose "Ask agent" from the node menu
    Then the composer is armed with "order"
    # The agent's own assertion: it was handed `order`, and `read_node` under
    # that id answers with the title the file holds. Asserted on the ANSWER and
    # in the agent's own sentence, because the chip on the message carries the
    # title as well — a step matching the bare title anywhere in the panel
    # passed on a build where the node never reached the prompt at all.
    When I ask the agent "context"
    Then the agent's answer says "order is the node titled order the new cabinets"
    # ...and the message itself says what it was about, which is what makes it
    # readable after a reload and in the other tab.
    And the message was about "order"
    # Sent means sent: the strip is empty and the next message is about
    # nothing until somebody arms it again.
    And the composer is armed with nothing

  @scratch:chat
  Scenario: An armed node can be taken off before the message goes
    When I open the node menu of "order"
    And I choose "Ask agent" from the node menu
    Then the composer is armed with "order"
    When I take the armed node "order" off
    Then the composer is armed with nothing
    When I ask the agent "context"
    Then the agent's answer says "no node in context"

  @scratch:chat
  Scenario: The node an olai write was about is one press away
    # The reference a transcript carries most often: every write through the
    # ops layer draws this row, and the reply has always named the node.
    When I ask the agent "done order"
    Then the chat says the write "marked done"
    When I press the node "order" in the write
    Then the node "order" is focused
    # ...IN PLACE, which is the half a lit-up row cannot say on its own: the
    # zoomed page draws that node too, with the same attribute on it, so a
    # press that always navigated would satisfy every other line here. The
    # address is what tells the two apart.
    And the address is "/house.olai"

  @scratch:chat
  Scenario: An id the agent named in its own prose is a reference, and nothing else is
    # No syntax was invented for this. The agent writes ids in backticks
    # because that is how every olai tool spells one, and a code span becomes
    # pressable exactly when the loaded set declares what it says.
    When I ask the agent "done order"
    Then the agent's answer names the node "order"
    When I press the node "order" in the answer
    Then the node "order" is focused
    And the address is "/house.olai"
    # ...and the same backticks around something the set does not declare stay
    # what they are. An agent writes them around file names and flags all day.
    When I ask the agent "edit"
    # Waited for FIRST: an absence asserted before the answer has arrived is an
    # absence about an empty panel, and it passed on a build that marked every
    # backtick there was.
    Then the agent's answer says "rewrote notes.md"
    But the agent's answer does not make "notes.md" a reference

  @scratch:chat
  Scenario: A PLACEMENT the agent named lands on the node it shows
    # An agent writes placement ids — `read_node` answers `mirrors` with them,
    # `remove_mirror` takes them — and a mirror is not a row: every row carries
    # the node it SHOWS. So a span marked with the placement's own id names no
    # row on the page, and the press leaves for a node that is right there.
    # The mirror is written here rather than into the fixture because it is
    # this scenario's subject and nobody else's.
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets"}
      {"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","doing":"2026-08-02"}
      {"id":"now-order","ord":"a1","mirror":"order"}
      """
    Then the node "now-order" is shown
    When I ask the agent "name now-order"
    # What the agent WROTE is `now-order`; what the reference points at is the
    # node standing there, which is what a `see` to the same placement does.
    Then the agent's answer names the node "order"
    When I press the node "order" in the answer
    Then the node "order" is focused
    And the address is "/house.olai"

  @scratch:chat
  Scenario: An armed node that has gone refuses the send rather than losing the subject
    # The join the units cannot make: a runtime that swallowed the resolver's
    # refusal and sent anyway would keep every one of them green, and the agent
    # would get a question with no subject in it.
    When I open the node menu of "order"
    And I choose "Ask agent" from the node menu
    Then the composer is armed with "order"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}
      {"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","doing":"2026-08-02"}
      """
    Then the node "order" is not shown
    When I ask the agent "context"
    Then the chat shows a refusal
    # ...and the message is still there to send again: what a refused send
    # threw away comes back, chips and all, exactly as a refused attachment
    # does.
    And the composer is armed with "order"

  @scratch:chat
  Scenario: A node that is not on the page opens its own page
    # Focusing is about the page in front of the reader, so when the node is
    # not drawn on it — another outline, a branch this reader has shut, a row
    # done-hidden left out — the reference goes to the node's own address
    # rather than doing nothing.
    When I collapse the node "kitchen"
    And I ask the agent "done order"
    And I press the node "order" in the write
    Then the address is "/#order"
    And the zoomed node is "order"
