Feature: Typing @ in the chat completes a file of the directory
  A message about a file has to be able to NAME it, and typing the path out is
  where that goes wrong: a vault spells its folders however it spells them, and
  a path half-remembered reaches the agent as a file that is not there. So `@`
  offers the served directory — the same files the sidebar draws, out of the
  key sets this tab already holds — and taking one writes the whole path into
  the sentence.

  What it writes is TEXT, not an attachment. The `+` button copies a file into
  a temp directory and hands the agent the path of the copy, which is right for
  a screenshot on the clipboard and wrong for a file that is already in the
  directory the agent is working in. This one is the word you would have typed.

  Every scenario is `@scratch:chat` — the panel needs an agent, and the agent
  is the scripted one in `agent/fake-acp-agent.ts`, whose fallback answer
  quotes the prompt back. That is what makes "the path reached the agent"
  something a scenario can read rather than assume.

  Background:
    Given I open the app
    And the agent panel is open

  @scratch:chat
  Scenario: An @ offers the directory, and taking a row writes the path
    When I type "read @cab" into the chat
    Then the path completion is open
    And the completion offers "notes/cabinets.md"
    # The row READS its name with the folder beside it — a vault of daily notes
    # is a column of identical prefixes otherwise — and WRITES the whole path.
    And the completion row "notes/cabinets.md" reads "cabinets.md" in "notes"
    When I accept the completion
    Then the chat input reads "read @notes/cabinets.md "

  @scratch:chat
  Scenario: The path reaches the agent as the word it is
    # The other half of the sentence above: nothing is attached, nothing is
    # copied, and what the agent is handed is the message as it reads. The
    # scripted agent quotes the prompt back, so this is the whole round trip.
    When I type "read @fin" into the chat
    Then the completion offers "finishes.md"
    When I accept the completion
    And I send the chat message
    Then the chat shows my message "read @finishes.md"
    And the agent's answer mentions "you said: read @finishes.md"

  @scratch:chat
  Scenario: It is the whole directory, filtered as you type
    # A bare `@` is a way of seeing what this vault even holds — the outline and
    # the documents together, because what a message may name is a FILE and not
    # a kind of file.
    When I type "look at @" into the chat
    Then the completion offers "house.olai"
    And the completion offers "finishes.md"
    And the completion offers "notes/cabinets.md"
    When I type "look at @fin" into the chat
    Then the completion offers "finishes.md"
    And the completion does not offer "house.olai"
    # ...and the folder is a way in too, which is what makes a nested vault
    # navigable by typing: `notes/` is the path's own start.
    When I type "look at @notes/" into the chat
    Then the completion offers "notes/cabinets.md"
    And the completion does not offer "finishes.md"

  @scratch:chat
  Scenario: The arrows walk it, and Enter takes the row they are on
    # The keys are the list's while it is up — the same cursor the ⌘K palette
    # and the row editor's widgets walk (`client/search/cursor.ts`), which is
    # the whole reason this box draws both of the composer's lists rather than
    # each one growing arrows of its own.
    When I type "read @" into the chat
    Then the completion offers "finishes.md"
    When I press "ArrowDown" in the chat
    And I accept the completion
    # Directory order, so the second row is the outline beside the document.
    Then the chat input reads "read @house.olai "

  @scratch:chat
  Scenario: A pointer takes the same row, and hands the caret back
    # The press moves focus to a button that the taking itself removes, so a
    # completion that did not put the caret back would leave the sentence
    # half-typed with nothing focused — a click spent rather than saved.
    When I type "read @cab" into the chat
    And I click the completion "notes/cabinets.md"
    Then the chat input reads "read @notes/cabinets.md "
    And the caret is in the chat box

  @scratch:chat
  Scenario: An @ inside a word is part of the word
    # `@` is a tag sigil in olai's own format, and the row editor completes
    # `@alice` against the tags the set writes. None of that vocabulary is in
    # this box — a message is prose on its way to an agent — but the rule about
    # where a sigil may OPEN is shared, and it is what keeps an address out of
    # this: nothing here may rewrite the middle of a word somebody is typing.
    When I type "mail srid@example.com about it" into the chat
    Then no completion is open

  @scratch:chat
  Scenario: A word nothing matches types straight through
    # The non-collision with `@person`, which is a habit rather than a syntax:
    # somebody who writes `@alice` in titles will write it here meaning the
    # person. No file matches, so there is no box, and no key means anything
    # other than what it always meant.
    When I type "ask @alice about the counters" into the chat
    Then no completion is open

  @scratch:chat
  Scenario: Escape puts the list away and the message sends as it reads
    # The escape hatch for the one case where a file DOES match a word that was
    # never meant as one: the list goes, the sentence is untouched, and the next
    # Enter is the send it was meant to be. Nothing is rewritten that was not
    # chosen.
    When I type "ask @finishes" into the chat
    Then the completion offers "finishes.md"
    When I press "Escape" in the chat
    Then no completion is open
    When I press "Enter" in the chat
    Then the chat shows my message "ask @finishes"

  @scratch:chat
  Scenario: What Escape puts away is the word, not the box
    # A dismissal is about the `@` it was pressed over, so the next one along
    # the line is a fresh offer. Escape meaning "no completions in this message"
    # would be a key that does far more than the thing it was pressed at.
    When I type "ask @finishes" into the chat
    Then the completion offers "finishes.md"
    When I press "Escape" in the chat
    Then no completion is open
    When I type "ask @finishes and @cab" into the chat
    Then the completion offers "notes/cabinets.md"

  @scratch:chat
  Scenario: A file that arrives while the panel is open can be named
    # The list is the directory as it IS: the paths come off the same live key
    # sets the sidebar draws, so a note written by anybody — another tab, a
    # terminal, the agent itself — is completable without a reload.
    When I rewrite "notes/splashback.md" as:
      """
      # Splashback

      Zellige, if the budget survives the carousel.
      """
    And I type "read @splash" into the chat
    Then the completion offers "notes/splashback.md"
