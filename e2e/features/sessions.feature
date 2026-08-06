Feature: past conversations, and whose they are

  The agent stores its conversations by the directory it worked in, and it is
  asked about a directory by PREFIX — so a checkout with a worktree under it
  is told about the worktree's chats too. Only the ones worked in exactly this
  directory are this panel's: the picker lists those, and boot comes up in the
  newest of those.

  What the machine had stored when the agent woke up is the scenario's tag —
  the fake agent reads it (support/hooks.js).

  @stored-sessions
  Scenario: the panel comes up in the last conversation from this directory
    Given the agent has woken up
    When I open the home page
    And I press the agent toggle
    Then the chat is titled "the last conversation"

  @stored-sessions
  Scenario: the picker lists this directory's chats and nobody else's
    Given the agent has woken up
    When I open the home page
    And I press the agent toggle
    And I press the sessions button
    Then the picker offers "the last conversation"
    And the picker offers "an older conversation"
    And the picker does not offer "another checkout's conversation"

  @stored-sessions
  Scenario: picking an older conversation replays it into the panel
    Given the agent has woken up
    When I open the home page
    And I press the agent toggle
    And I press the sessions button
    And I pick the conversation "an older conversation"
    Then the chat is titled "an older conversation"
    And the last turn quotes me "what did we do"
    And the last turn reads "we shipped it"
    And the last turn ran the tool "read Roadmap.rkt"

  # Another checkout's conversation is newer than anything here, and adopting
  # it is how a task agent's coding session used to become the web chat. With
  # nothing of this directory's stored, the panel starts a conversation of its
  # own instead.
  @foreign-sessions
  Scenario: another checkout's conversation is not adopted, and not offered
    Given the agent has woken up
    When I open the home page
    And I press the agent toggle
    Then the chat is not titled "another checkout's conversation"
    And the transcript is empty
    When I press the sessions button
    Then the picker says there are no past chats here
    And the picker does not offer "another checkout's conversation"

  @foreign-sessions
  Scenario: a fresh conversation still starts here
    When I open the home page
    And I press the agent toggle
    And I send "what is in the outline" to the agent
    Then the last turn reads "hello world"

  # KNOWN BROKEN: the panel a page opens with is only as current as the agent.
  # `serve` prints its URL and answers requests while the agent is still waking
  # up in its own thread, and its boot frames (model, session, commands) are
  # BROADCAST — a page opened in that window is not listening yet, and the
  # server-rendered panel it did get was drawn before any of them landed. The
  # conversation is there; the panel does not say which one until something
  # else makes it redraw. Every other scenario here waits the boot out
  # (`the agent has woken up`), which is the harness admitting it.
  # Same shape as the racket suite's parked boot-frame race (Roadmap.rkt).
  @skip @stored-sessions
  Scenario: a page opened while the agent is still waking up says which chat it is in
    When I open the home page
    And I press the agent toggle
    Then the chat is titled "the last conversation"
