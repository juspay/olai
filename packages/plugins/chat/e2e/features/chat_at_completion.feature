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
  is the scripted one driven by `@olai/tests/agent/scripted-acp.ts`, whose fallback answer
  quotes the prompt back. That is what makes "the path reached the agent"
  something a scenario can read rather than assume.

  Background:
    Given I open the outline "house.olai"
    And I mark the page
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  @scratch:chat
  Scenario: An @ offers the directory, and taking a row writes the path
    When I type "read @cab" into the chat
    Then the name completion is open
    And the completion offers "notes/cabinets.md"
    And the completion row "notes/cabinets.md" reads "cabinets.md" in "notes"
    When I accept the completion
    Then the chat input reads "read @notes/cabinets.md "

  @scratch:chat
  Scenario: The path reaches the agent as the word it is
    When I type "read @fin" into the chat
    Then the completion offers "finishes.md"
    When I accept the completion
    And I send the chat message
    Then the chat shows my message "read @finishes.md"
    And the agent's answer mentions "you said: read @finishes.md"

  @scratch:chat
  Scenario: It is the whole directory, filtered as you type
    When I type "look at @" into the chat
    Then the completion offers "_olai/Trash.olai"
    And the completion offers "house.olai"
    And the completion offers "finishes.md"
    And the completion offers "notes/cabinets.md"
    When I type "look at @fin" into the chat
    Then the completion offers "finishes.md"
    And the completion does not offer "house.olai"
    When I type "look at @notes/" into the chat
    Then the completion offers "notes/cabinets.md"
    And the completion does not offer "finishes.md"

  @scratch:chat
  Scenario: Completing INSIDE a sentence writes one space, and keeps the caret
    When I type "read @fin later" into the chat
    And I put the caret after "read @fin" in the chat
    Then the completion offers "finishes.md"
    When I accept the completion
    Then the chat input reads "read @finishes.md later"
    And the caret in the chat box is at 18

  @scratch:chat
  @review-menu
  Scenario: The arrows walk it, and Enter takes the row they are on
    When I type "read @" into the chat
    Then the completion offers "finishes.md"
    And the active chat completion is "_olai/Settings.olai"
    When I press "ArrowDown" in the chat
    And the chat box reports its unchanged caret
    Then the active chat completion is "_olai/Trash.olai"
    When I press "ArrowDown" in the chat
    Then the active chat completion is "finishes.md"
    When I accept the completion
    Then the chat input reads "read @finishes.md "

  @scratch:chat
  Scenario: A keystroke is a new question, so the arrows start again at the top
    When I type "read @" into the chat
    Then the completion offers "notes/cabinets.md"
    When I press "ArrowDown" in the chat
    And I press "ArrowDown" in the chat
    And I type "read @s" into the chat
    Then the completion offers "notes/cabinets.md"
    When I accept the completion
    Then the chat input reads "read @_olai/Settings.olai "

  @scratch:chat
  Scenario: A pointer takes the same row, and hands the caret back
    When I type "read @cab" into the chat
    And I click the completion "notes/cabinets.md"
    Then the chat input reads "read @notes/cabinets.md "
    And the caret is in the chat box

  @scratch:chat
  Scenario: An @ inside a word is part of the word
    When I type "mail srid@example.com about it" into the chat
    Then no completion is open

  @scratch:chat
  Scenario: A word nothing matches types straight through
    When I type "ask @alice about the counters" into the chat
    Then no completion is open

  @scratch:chat
  Scenario: Escape puts the list away and the message sends as it reads
    When I type "ask @finishes" into the chat
    Then the completion offers "finishes.md"
    When I press "Escape" in the chat
    Then no completion is open
    When I press "Enter" in the chat
    Then the chat shows my message "ask @finishes"

  @scratch:chat
  Scenario: What Escape puts away is the word, not the box
    When I type "ask @finishes" into the chat
    Then the completion offers "finishes.md"
    When I press "Escape" in the chat
    Then no completion is open
    When I type "ask @finishes and @cab" into the chat
    Then the completion offers "notes/cabinets.md"

  @scratch:chat
  Scenario: A file that arrives while the panel is open can be named
    When I rewrite "notes/splashback.md" as:
      """
      # Splashback

      Zellige, if the budget survives the carousel.
      """
    And I type "read @splash" into the chat
    Then the completion offers "notes/splashback.md"
    And the page has not reloaded
