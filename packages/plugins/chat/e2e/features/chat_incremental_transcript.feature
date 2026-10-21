@agent-stored @scratch:chat
Feature: A long conversation arrives at its end, and a reconnect keeps what the tab holds
  The transcript is a surface collection, and a subscription's first frame is a
  snapshot of the whole set. For a conversation thousands of messages long that
  snapshot used to be several MB, which on a slow link outlasted the transport's
  own keepalive: the pong queued behind the frame, the socket died, the tab
  redialled, and the server resent the whole conversation.

  A subscribe now ships the recent window and pulls older rows a page at a time
  (`olai-plugin-chat`'s `TRANSCRIPT_WINDOW`, `conversation.earlier`). The live
  half is unchanged: rows that stream in still arrive as batched deltas, so a
  conversation OPENED for the first time still arrives whole.

  A window must never take back what the tab already holds. A RE-SEEDING redial
  ships a smaller frame, and the rows that fall below it move into a client-held
  history rather than vanishing; only a conversation that restarted (a fresh
  start or a replay) empties it. The door is for rows the tab NEVER had — a tab
  that joined a reading somebody else was already holding.

  Background:
    Given I open the outline "house.olai"
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And the node agent's fold is ready

  Scenario: A re-seeding redial keeps every row the tab already holds
    When I arm a long history on the next stored conversation
    And I open the fold history
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    # The conversation opened whole: each replayed row arrived as its own delta.
    And the transcript holds more than 100 rows
    # A ROSTER CHANGE SUPERSEDES THE CONNECTION. Where that re-seeds the
    # transcript — a fresh subscription does — the rows outside the window go to
    # the client-held history rather than vanishing. (A network drop does not
    # re-seed: the link retains the stream.)
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "git" off
    And I use the original browser tab
    # THE READER IS NOT THROWN BACK TO SIXTY ROWS, and the door counts only rows
    # the tab never had — there are none.
    Then the transcript holds more than 100 rows
    And there are no earlier messages to load

  Scenario: A long conversation over a throttled link stays live
    When I arm a long history on the next stored conversation
    And I open the fold history
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    And the transcript holds more than 100 rows
    # SLOW THE SOCKET. The window's own size is pinned by `readings.test.ts`,
    # and a re-seed keeps the rows above; this is the link the defect was
    # measured on, and the page must stay live on it.
    When I throttle the network
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "git" off
    And I use the original browser tab
    # FIFTEEN SECONDS, past the keepalive's fatal silence: a frame that starved
    # the pong would drop the socket here and flap.
    Then the connection is "live"
    And the connection stays "live"
    And the transcript holds more than 100 rows
    And there are no earlier messages to load
