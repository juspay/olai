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
    Given I open the outline "house.jsonl"
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

  @scratch:chat
  Scenario: An id the agent named in its own prose is a reference, and nothing else is
    # No syntax was invented for this. The agent writes ids in backticks
    # because that is how every olai tool spells one, and a code span becomes
    # pressable exactly when the loaded set declares what it says.
    When I ask the agent "done order"
    Then the agent's answer names the node "order"
    When I press the node "order" in the answer
    Then the node "order" is focused
    # ...and the same backticks around something the set does not declare stay
    # what they are. An agent writes them around file names and flags all day.
    When I ask the agent "edit"
    # Waited for FIRST: an absence asserted before the answer has arrived is an
    # absence about an empty panel, and it passed on a build that marked every
    # backtick there was.
    Then the agent's answer says "rewrote notes.md"
    But the agent's answer does not make "notes.md" a reference

  @scratch:chat
  Scenario: A node that is not on the page opens its own page
    # Focusing is about the page in front of the reader, so when the node is
    # not drawn on it — another outline, a branch this reader has shut, a row
    # done-hidden left out — the reference goes to the node's own address
    # rather than doing nothing.
    When I collapse the node "kitchen"
    And I ask the agent "done order"
    And I press the node "order" in the write
    Then the address is "/n/order"
    And the zoomed node is "order"
