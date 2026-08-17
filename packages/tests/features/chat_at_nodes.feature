Feature: Typing @ in the chat completes a node of the directory
  The `@` list already offered the served directory's FILES. A message about a
  row could not name it: you pasted the path of the outline it sits in and
  hoped, or you left the panel, found the row, and used its `•••` menu. So the
  same `@` offers the directory's NODES beside its files — one list, two blocks,
  files first — and taking a node writes `@its-id ` into the sentence AND arms
  the node, which is the gesture "Ask agent" already had.

  The two halves of that carry different facts. The WORD says where in the
  sentence the node is meant: `compare @a with @b` is unsayable by two chips.
  The ARMING is what makes the id resolvable — the server answers it against the
  live set and puts the title, the `file:line` and the ancestors under the
  message, which is the protocol `features/node_context.feature` already pins.
  Nothing new reaches the agent, and nothing new was invented for it to parse.

  What the list offers is the format's own matcher (`@olai/format`'s
  `parseFilter` / `matching`), so a word here means what it means in the filter
  bar, in the ⌘K palette and in an agent's `search_nodes` — including
  `is:archived`, which is the only way to reach what was put away, and the whole
  of this door's archive rule (#226).

  Every scenario is `@scratch:chat` — the panel needs an agent, and the agent is
  the scripted one in `agent/fake-acp-agent.ts`, whose fallback answer quotes
  the prompt back. That is what makes "the node reached the agent" something a
  scenario can read rather than assume.

  Background:
    Given I open the app
    And I mark the page
    And the agent panel is open

  @scratch:chat
  Scenario: An @ offers the nodes as well as the files, and says which is which
    When I type "look at @cab" into the chat
    Then the name completion is open
    # One word, two answers: the document whose name starts with it, and the
    # node whose title holds it. Neither is ranked against the other — they are
    # two blocks under one cursor, files first.
    And the completion offers "notes/cabinets.md"
    And the completion offers "order"
    And the completion block "files" comes before the block "nodes"
    # The row reads the TITLE, and what it writes is beside it: the id first,
    # because it is the only always-unique half — then where the node sits,
    # nearest first. The `·` belongs to the PLACE and to nothing else, so a
    # reader never has to work out which dots are boundaries and which are
    # ancestry.
    And the completion row "order" reads "order the new cabinets" in "@order — kitchen remodel #home"

  @scratch:chat
  Scenario: Taking a node writes its id and arms the node
    When I type "look at @hing" into the chat
    Then the completion offers "hinges"
    When I accept the completion
    Then the chat input reads "look at @hinges "
    # The chip is the other half, and it reads the TITLE out of the live set —
    # so the sentence carries the handle and the strip says what the handle is.
    And the composer is armed with "hinges"

  @scratch:chat
  Scenario: The node reaches the agent as a handle, under the words
    # The whole round trip, asserted by the AGENT rather than about a popup: a
    # node taken off the list reaches the prompt as the line `•••` Ask agent
    # already produced — the id in backticks, the title, the `file:line`, the
    # titles it hangs under — and the scripted agent reads that line, calls
    # `read_node` with the id it found, and says the title that came back. No
    # spelling of the prompt that lost the id could produce that sentence
    # (`features/node_context.feature` argues it at length).
    When I type "context @hing" into the chat
    Then the completion offers "hinges"
    When I accept the completion
    And I send the chat message
    # The word went with it, exactly as it was written into the sentence.
    Then the chat shows my message "context @hinges"
    And the agent's answer says "hinges is the node titled pick the hinges"

  @scratch:chat
  Scenario: Two nodes of one title are told apart by where they sit
    # The reason a row says more than its title: a vault gets two of these by
    # copy-paste, and a completion that drew them identically would be asking
    # somebody to pick blind.
    When I type "chase @supplier" into the chat
    Then the completion offers "chase-supplier"
    And the completion offers "chase-tiler"
    And the completion row "chase-supplier" reads "chase the supplier" in "@chase-supplier — install the cabinets · kitchen remodel #home"
    And the completion row "chase-tiler" reads "chase the supplier" in "@chase-tiler — kitchen remodel #home"

  @scratch:chat
  Scenario: A row says when it is here for something written in the note
    # `brass` is in the note under `pick the hinges` and in no title anywhere,
    # so the row's own label holds none of what was typed. Every other field a
    # word is looked for in is already visible on the row — the title IS the
    # label, the id is beside it, a tag is inside the title — so the note is the
    # only one that has to say so.
    When I type "the @brass" into the chat
    Then the completion offers "hinges"
    And the completion row "hinges" reads "pick the hinges" in "@hinges (in the note) — install the cabinets · kitchen remodel #home"

  @scratch:chat
  Scenario: The words are the last word — deleting one takes its chip
    When I type "look at @hing" into the chat
    And I accept the completion
    Then the composer is armed with "hinges"
    # Nothing to disarm and nothing to remember: what the message is about is
    # what the message still says.
    When I type "look at " into the chat
    Then the composer is armed with nothing
    # ...and putting the word back is putting the node back, without the list.
    When I type "look at @hinges again" into the chat
    Then the composer is armed with "hinges"
    # ...and a comma after it is the sentence's, not the name's: a chip that went
    # out from under somebody who only typed punctuation would be the one thing
    # this rule must never do by accident.
    When I type "look at @hinges, then the doors" into the chat
    Then the composer is armed with "hinges"

  @scratch:chat
  Scenario: The chip's × takes the word out of the sentence
    # One press, one meaning: this message is not about that node. A chip that
    # went while its word stayed would come straight back — the words are what
    # the strip is read from.
    When I type "look at @hing" into the chat
    And I accept the completion
    Then the chat input reads "look at @hinges "
    When I take the armed node "hinges" off
    Then the composer is armed with nothing
    And the chat input reads "look at "

  @scratch:chat
  Scenario: A word nobody took off the list arms nothing
    # The promise that this is not a parser of prose. `tiles` IS an id in this
    # directory, and typing it means nothing at all: only a row that was CHOSEN
    # puts a node on the message.
    When I type "ask @tiles about it" into the chat
    Then the composer is armed with nothing
    When I send the chat message
    Then the chat shows my message "ask @tiles about it"

  @scratch:chat
  Scenario: What was put away is not offered, and is:archived is how to ask
    # #226's ruling, inherited rather than respelled: the matcher reads the
    # query's own `is:archived` before it walks, so this door has no archive
    # rule of its own to drift from that one.
    When I type "the @tiles" into the chat
    Then the completion does not offer "tiles"
    When I type "the @is:archived" into the chat
    Then the completion offers "tiles"
    When I accept the completion
    Then the chat input reads "the @tiles "
    # ...and what the agent is told about it is that it WAS put away. Naming an
    # archived node is allowed on purpose — "why did we put this away?" is a
    # fair question — and no tool refuses a write into an archive, so a row
    # arriving as ordinary work would be worked on as ordinary work.
    When I type "context @tiles" into the chat
    And I send the chat message
    Then the agent's answer says "tiles is the node titled the tiles nobody liked, and it was put away"

  @scratch:chat
  Scenario: The grammar is the grammar — one token of it, anyway
    # `@` names one node; ⌘K searches. What fits in a word works, because the
    # query is read by the same parser every other door uses.
    When I type "look at @is:done" into the chat
    Then the completion offers "demo"
    And the completion does not offer "install"
    When I type "look at @#home" into the chat
    Then the completion offers "kitchen"

  @scratch:chat
  Scenario: A file still wins the first row, and Enter still takes it
    # The gesture that shipped first does not change: `@cab` and Enter has
    # written a path since the `@` list existed, and a completion that quietly
    # re-aimed Enter would be one to re-learn.
    When I type "read @cab" into the chat
    Then the completion offers "notes/cabinets.md"
    When I accept the completion
    Then the chat input reads "read @notes/cabinets.md "
    And the composer is armed with nothing

  @scratch:chat
  Scenario: A node written while the panel is open can be named
    # The list is the set as it IS: the nodes come off the same subscription the
    # tree draws, so a row somebody else writes — another tab, a terminal, the
    # agent itself — is nameable without a reload, on the page that was already
    # open.
    When I rewrite "splashback.olai" as:
      """
      {"id":"splashback","ord":"a0","title":"the splashback, zellige if the budget survives"}
      """
    And I type "look at @zellige" into the chat
    Then the completion offers "splashback"
    # Without this line a full reload would pass the scenario, which is the one
    # thing a "no reload" claim is for.
    And the page has not reloaded
