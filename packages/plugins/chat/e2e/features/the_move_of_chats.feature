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
    # THE NOTE HAS THE TIE NOW, and says how it opens.
    Then the note "notes/plan.md" carries the tie "claude:fake-session-1" and opens alone
    # ...and the row it came from is still there, with its memory under it and
    # no agent of its own.
    And the chat row "plan-row" is still titled "[plan](/notes/plan.md)" with 2 children and no agent
    # NOTHING ELSE MOVED: an outline is not a note, an ordinary chat row never
    # stood in for anything, and a note that already had a different tie keeps
    # it — so its row keeps its agent too, and the two are left to the person.
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
