@scratch:chat
Feature: A long conversation arrives at its end, and older messages load on demand
  The transcript is a surface collection, and a subscription's first frame is a
  snapshot of the whole set. For a conversation thousands of messages long that
  snapshot used to be several MB, which on a slow link outlasted the transport's
  own keepalive: the pong queued behind the frame, the socket died, the tab
  redialled, and the server resent the whole conversation. Every other
  subscription on the socket queued behind it too, so the panel showed its
  loading panes and default-seeded cells after each reconnect.

  A subscribe now ships the recent window and a count of the rows older than it
  (`olai-plugin-chat`'s `TRANSCRIPT_WINDOW`, `conversation.earlier`), and the
  older rows come back a page at a time behind the "earlier messages" door. The
  live half is unchanged: rows that stream in still arrive as batched deltas, so
  a conversation OPENED for the first time still arrives whole — the window is
  what a RECONNECT costs, and this is where it is measured.

  Scenario: A reconnect ships the window, and the door loads the rest
    Given I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I arm a long history on the next stored conversation
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    # The conversation opened whole: each replayed row arrived as its own delta.
    And the transcript holds more than 60 rows
    When the browser goes offline
    Then the connection is "reconnecting"
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    # THE RECONNECT RE-SHIPPED A BOUNDED FRAME — the newest rows, not the
    # conversation — and left the rest behind a door.
    And the transcript holds at most 60 rows
    And the earlier messages door is drawn
    # ... and the page behind the door is the rows the reconnect left behind.
    When I load earlier messages
    Then the transcript holds more than 60 rows

  Scenario: A long conversation over a throttled link stays live
    Given I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I arm a long history on the next stored conversation
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    And the transcript holds more than 60 rows
    # SLOW THE LINK, then drop and redial the socket under it. The frame the
    # reconnect ships is the window, so it drains inside the keepalive and the
    # page comes back live with the conversation drawn and the door offering the
    # rest — where the whole-conversation snapshot of the bug never could.
    When I throttle the network
    And the browser goes offline
    Then the connection is "reconnecting"
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    And the transcript holds at most 60 rows
    And the earlier messages door is drawn
