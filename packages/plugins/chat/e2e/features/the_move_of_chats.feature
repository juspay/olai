@scratch:move-chats
Feature: The one-time move of chats onto their notes
  A vault written by the earlier phase holds chat rows under `_olai/Inbox.olai`
  › Chats whose TITLE is an address — `[plan](/notes/plan.md)` — standing in for
  the place they are about. A note carries its own tie now, so the first
  reading of such a vault moves it: the note gets `chat-agent-session` and
  `chat-opens: alone`, and the row that was standing in for it gives up its
  property. The row itself is never moved, retitled or deleted, and everything
  that was never a stand-in is left completely alone.

  It runs once, before anything else writes a binding, and running it twice is
  running it once: a restart finds nothing left to do.

  Scenario: The first reading moves a stand-in's chat onto its note, and leaves everything else
    Given I open the app
    Then the note "notes/plan.md" carries the tie "claude:fake-session-1" and opens alone
    And the chat row "plan-row" is still titled "[plan](/notes/plan.md)" with 2 children and no agent
    And the chat row "house-row" keeps the agent "claude:fake-session-2"
    And the chat row "ordinary-row" keeps the agent "claude:fake-session-3"
    And the chat row "kept-row" keeps the agent "claude:fake-session-4"
    And the note "notes/kept.md" carries the tie "claude:fake-session-9" and nothing else
    And there should be no page errors

  Scenario: Restarting the server changes nothing more
    Given I open the app
    Then the note "notes/plan.md" carries the tie "claude:fake-session-1" and opens alone
    When the server stops
    And the server starts again on the same port
    And I open the app
    Then the note "notes/plan.md" carries the tie "claude:fake-session-1" and opens alone
    And the chat row "plan-row" is still titled "[plan](/notes/plan.md)" with 2 children and no agent
    And the chat row "house-row" keeps the agent "claude:fake-session-2"
    And the chat row "ordinary-row" keeps the agent "claude:fake-session-3"
    And the chat row "kept-row" keeps the agent "claude:fake-session-4"
    And the note "notes/kept.md" carries the tie "claude:fake-session-9" and nothing else
    And there should be no page errors

  Scenario: A chat left on its row is called by its link's label
    Given I open the app
    Then the Chats row "house-row" reads "house" with no file mark
    And the Chats row "ordinary-row" reads "an ordinary chat" with no file mark
    When I press the Chats row "house-row"
    Then the chat page is about the node "house-row" named "house" in "_olai/Inbox.olai"
    And there should be no page errors

  Scenario: New chat lists a row left behind by its link's label
    Given I open the app
    When I press new chat in Chats
    And I type "loft" into the palette
    Then the new chat item "loft-row" is named "loft"
    When I type "attic" into the palette
    Then the new chat items do not include "loft-row"
    And there should be no page errors
