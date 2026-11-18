@scratch:chat
Feature: A long chat leaves the note beside it alone
  The complaint this whole change began with: a conversation that grows used
  to move the thing it was about. An answer arriving while somebody was
  reading took the page with it — the chat and the note shared one scroll, so
  forty lines of agent pushed paragraph eleven off the screen.

  A pane is the answer, and this is the promise read from the reader's side: a
  chat that floods its own column scrolls THAT column, and the note beside it
  is exactly where it was left, down to the word.

  Scenario: The note does not move while the chat beside it floods
    Given the vault holds a note long enough to scroll "notes/plan.md"
    And I open the document "notes/plan.md"
    Then the note line is about the note "notes/plan.md"
    # The chat opens in the pane beside the note, which is what gives the two
    # of them a scroll each to be a claim about.
    When I ask about this page "what is left to decide"
    Then the note "notes/plan.md" carries a chat as "plan-chat"
    And the chat page is about the note "notes/plan.md" named "plan"
    And the chat page conversation is ready
    # SOMEBODY IS READING, part way down the note and nowhere near either end:
    # the position a chat that moved the page would cost them.
    When I scroll the note beside the chat down
    And I remember where the note stands
    # ...AND THE CHAT FLOODS: forty lines into one growing answer, which is
    # more than its column holds, so it scrolls the whole time it arrives.
    When I ask the agent "flood"
    Then the chat eventually shows "line 39"
    And the chat beside it has scrolled to its newest line
    And the note beside it stands exactly where it was, word for word
    And there should be no page errors
