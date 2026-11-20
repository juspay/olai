Feature: Typing @ in the chat completes a node of the directory
  The `@` list already offered the served directory's FILES. A message about a
  row could not name it: you pasted the path of the outline it sits in and
  hoped, or you left the panel, found the row, and used its `•••` menu. So the
  same `@` offers the directory's NODES beside its files — one list, two blocks,
  files first — and taking a node writes `@its-id ` into the sentence AND arms
  the node, which is the gesture a dropped row has.

  The two halves of that carry different facts. The WORD says where in the
  sentence the node is meant: `compare @a with @b` is unsayable by two chips.
  The ARMING is what makes the id resolvable — the server answers it against the
  live set and puts the title, the `file:line` and the ancestors under the
  message, which is the protocol `features/node_context.feature` already pins.
  Nothing new reaches the agent, and nothing new was invented for it to parse.

  What the list offers is the format's own matcher (`@olai/format`'s
  `parseFilter` / `matching`), so a word here means what it means in the filter
  bar, in the ⌘K palette and in an agent's `search_nodes` — including
  `is:trashed`, which is the only way to reach what was put away, and the whole
  of this door's archive rule (#226).

  Every scenario is `@scratch:chat` — the panel needs an agent, and the agent is
  the scripted one driven by `@olai/tests/agent/scripted-acp.ts`, whose fallback answer quotes
  the prompt back. That is what makes "the node reached the agent" something a
  scenario can read rather than assume.

  Background:
    Given I open the outline "house.olai"
    And I mark the page
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  @scratch:chat
  Scenario: An @ offers the nodes as well as the files, and says which is which
    When I type "look at @cab" into the chat
    Then the name completion is open
    And the completion offers "notes/cabinets.md"
    And the completion offers "order"
    And the completion block "files" comes before the block "nodes"
    And the completion row "order" reads "order the new cabinets" in "@order house.olai · kitchen remodel #home"

  @scratch:chat
  Scenario: Taking a node writes its id and arms the node
    When I type "look at @hing" into the chat
    Then the completion offers "hinges"
    When I accept the completion
    Then the chat input reads "look at @hinges "
    And the composer is armed with "hinges"

  @scratch:chat
  Scenario: The node reaches the agent as a handle, under the words
    When I type "context @hing" into the chat
    Then the completion offers "hinges"
    When I accept the completion
    And I send the chat message
    Then the chat shows my message "context @hinges"
    And the agent's answer says "hinges is the node titled pick the hinges"

  @scratch:chat
  Scenario: Two nodes of one title are told apart by where they sit
    When I type "chase @supplier" into the chat
    Then the completion offers "chase-supplier"
    And the completion offers "chase-tiler"
    And the completion row "chase-supplier" reads "chase the supplier" in "@chase-supplier house.olai · kitchen remodel #home · install the cabinets"
    And the completion row "chase-tiler" reads "chase the supplier" in "@chase-tiler house.olai · kitchen remodel #home"

  @scratch:chat
  Scenario: A row says when it is here for something written in the note
    When I type "the @brass" into the chat
    Then the completion offers "hinges"
    And the completion row "hinges" reads "pick the hinges" in "@hinges (in the note) house.olai · kitchen remodel #home · install the cabinets"

  @scratch:chat
  Scenario: The words are the last word — deleting one takes its chip
    When I type "look at @hing" into the chat
    Then the completion offers "hinges"
    When I accept the completion
    Then the composer is armed with "hinges"
    When I type "look at " into the chat
    Then the composer is armed with nothing
    When I type "look at @hinges again" into the chat
    Then the composer is armed with "hinges"
    When I type "look at @hinges, then the doors" into the chat
    Then the composer is armed with "hinges"

  @scratch:chat
  Scenario: A completion writes no space in front of the sentence's own punctuation
    When I type "look at @hing, then the doors" into the chat
    And I put the caret after "look at @hing" in the chat
    Then the completion offers "hinges"
    When I accept the completion
    Then the chat input reads "look at @hinges, then the doors"
    And the caret in the chat box is at 16
    And the composer is armed with "hinges"

  @scratch:chat
  Scenario: The chip's × takes the word out of the sentence
    When I type "look at @hing" into the chat
    Then the completion offers "hinges"
    When I accept the completion
    Then the chat input reads "look at @hinges "
    When I take the armed node "hinges" off
    Then the composer is armed with nothing
    And the chat input reads "look at "

  @scratch:chat
  Scenario: A node that goes between the row and the send refuses, and everything comes back
    When I type "context @hing" into the chat
    Then the completion offers "hinges"
    When I accept the completion
    Then the composer is armed with "hinges"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","custom":{"chat-agent-session":"claude:fake-session-1"}}
      {"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","doing":"2026-08-02"}
      """
    Then the node "hinges" is not shown
    When I send the chat message
    Then the chat shows a refusal
    And the chat input reads "context @hinges "
    And the composer is armed with "hinges"

  @scratch:chat
  Scenario: A word nobody took off the list arms nothing
    When I type "ask @tiles about it" into the chat
    Then the composer is armed with nothing
    When I send the chat message
    Then the chat shows my message "ask @tiles about it"

  @scratch:chat
  Scenario: What was put away is not offered, and is:trashed is how to ask
    When I type "the @tiles" into the chat
    Then the completion does not offer "tiles"
    When I type "the @is:trashed" into the chat
    Then the completion offers "tiles"
    When I accept the completion
    Then the chat input reads "the @tiles "
    When I type "context @tiles" into the chat
    And I send the chat message
    Then the agent's answer says "tiles is the node titled the tiles nobody liked, and it was put away"

  @scratch:chat
  Scenario: The same search grammar works across spaces
    When I type "look at @is:done" into the chat
    Then the completion offers "demo"
    And the completion does not offer "install"
    When I type "look at @#home" into the chat
    Then the completion offers "kitchen"
    When I type "look at @is:done " into the chat
    Then the completion offers "demo"
    When I type "look at @is:done demo" into the chat
    Then the completion offers "demo"
    And the completion does not offer "install"

  @scratch:chat
  Scenario: A file still wins the first row, and Enter still takes it
    When I type "read @cab" into the chat
    Then the completion offers "notes/cabinets.md"
    When I accept the completion
    Then the chat input reads "read @notes/cabinets.md "
    And the composer is armed with nothing

  @scratch:chat
  Scenario: A node written while the panel is open can be named
    When I rewrite "splashback.olai" as:
      """
      {"id":"splashback","ord":"a0","title":"the splashback, zellige if the budget survives"}
      """
    And I type "look at @zellige" into the chat
    Then the completion offers "splashback"
    And the page has not reloaded
