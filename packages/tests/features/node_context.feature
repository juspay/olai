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
  Scenario: A node that is not on the page is landed at its own row
    # A reference press means SHOW THIS NODE, and a branch the reader has shut
    # cannot stand in its way: the press lands the reader on the node's own
    # file at the row — unfolded, selected, on screen — rather than zooming
    # away from the page they had (`/#id` still means zoom; the reference row
    # is not one).
    When I collapse the node "kitchen"
    And I ask the agent "done order"
    And I press the node "order" in the write
    Then the address is "/house.olai#order"
    And the node "kitchen" is expanded
    And the node "order" is focused

  @scratch:chat
  Scenario: A node in another outline lands the reader on that outline
    # The other half of the same sentence: the address the reader lands on is
    # spelled with the file the node LIVES IN, asked at press time — the id is
    # durable and the file is not, so the transcript's hat on an old write
    # still lands where the node IS.
    When I ask the agent "done fence"
    And I press the node "fence" in the write
    Then the address is "/yard.olai#fence"
    And the node "fence" is focused

  @scratch:chat @wire
  Scenario: Typing beside an armed chip does not ask again what the node is called
    # WHAT THE CHIP COSTS, which nothing on screen can say. The title is a fact
    # about the vault, asked of the server when the ARMING moves and not when a
    # letter is typed (`client/chat/chips.ts` states the bound). What it was
    # asked of is derived from the DRAFT — the words are the last word about
    # which nodes a sentence is about — so without an equality every keystroke
    # minted the same one id in a new array, and a sentence cost one lookup per
    # letter for a strip that could not have changed.
    #
    # Counted on the wire because a chip drawn from a title asked for once and a
    # chip drawn from the same title asked for twenty times are the same chip.
    When I open the node menu of "order"
    And I choose "Ask agent" from the node menu
    Then the composer is armed with "order"
    When I mark the wire
    And I type "what about the cabinets" into the chat a letter at a time
    Then the chat input reads "what about the cabinets"
    And the tab has asked what the armed nodes are called 0 times
    # …and the strip still says what it says: the point is that the answer was
    # already had, not that the question stopped being asked.
    And the composer is armed with "order"
