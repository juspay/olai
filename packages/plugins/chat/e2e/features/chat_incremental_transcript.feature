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

  A window must never take back what the tab already holds. A reconnect ships a
  smaller frame, and the rows that fall below it move into a client-held history
  rather than vanishing; only a conversation that restarted (a fresh start or a
  replay) empties it. The door is for rows the tab NEVER had — a tab that joined
  a reading somebody else was already holding.

  Background:
    Given I open the outline "house.olai"
    When I open the filed conversation "the last conversation" as node "filed-chat"
    And the node agent's fold is ready

  Scenario: A reconnect keeps every row the tab already holds
    When I arm a long history on the next stored conversation
    And I open the fold history
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    # The conversation opened whole: each replayed row arrived as its own delta.
    And the transcript holds more than 100 rows
    When the browser goes offline
    Then the connection is "reconnecting"
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    # THE RECONNECT SHIPPED THE WINDOW AND TOOK NOTHING AWAY: the reader is not
    # thrown back to sixty rows, and the door counts only rows the tab never had
    # — there are none.
    And the transcript holds more than 100 rows
    And there are no earlier messages to load

  Scenario: A tab that never had the older rows sees the door
    When I arm a long history on the next stored conversation
    And I open the fold history
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    And the transcript holds more than 100 rows
    # Leaving the conversation and coming back mounts a NEW reading over the one
    # the server still holds, so this tab's first frame is the window.
    When I return to the node agent's current session
    And I open the fold history
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    And the transcript holds at most 60 rows
    And the earlier messages door is drawn
    # ... and the page behind the door is the rows this tab never had.
    When I load earlier messages
    Then the transcript holds more than 60 rows

  Scenario: A long conversation over a throttled link stays live
    When I arm a long history on the next stored conversation
    And I open the fold history
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    And the transcript holds more than 100 rows
    # SLOW THE LINK, then drop and redial the socket under it. The frame the
    # reconnect ships is the window, so it drains inside the keepalive and the
    # page comes back live with every row still on screen.
    When I throttle the network
    And the browser goes offline
    Then the connection is "reconnecting"
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    And the transcript holds more than 100 rows
    And there are no earlier messages to load
