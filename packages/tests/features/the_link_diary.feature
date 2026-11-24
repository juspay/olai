@scratch:good
Feature: The server's log says why a tab's connection dropped
  When the page says "Connection lost", somebody reading the server's log wants
  to know why. So each tab keeps a diary of its socket — dialled, opened,
  dropped and why, the card going up and coming down — and posts it to the
  server, which logs every entry with `side=browser` beside its own lines about
  the same socket. `tab` and `dial` join the two accounts.

  Every way a browser can stage a drop is here, staged from the outside: a man
  in the middle on the socket, the network going, the socket's row switched
  off, a server restarted. What is asserted is the server's stdout, because
  that is the claim — the log says why. And the ordinary life of a tab, opened
  and closed, says nothing at the default level. These cut the wire under an
  open tab, and one restarts the server, which is why they are `@scratch:`.

  Scenario: An ordinary page load and an ordinary tab close add nothing at the default level
    Given I open the outline "house.olai"
    And the connection is "live"
    When I close this browser tab
    Then for 3 seconds the server logs nothing from the browser and no "tab connected" or "tab disconnected"

  Scenario: A blink is the peer's doing, and both ends name the same socket
    Given the page's socket runs through a middle
    And I open the outline "house.olai"
    And the connection is "live"
    When the middle closes the socket with code 4000
    Then the connection is "live"
    And the server logs "tab disconnected" with "code=4000"
    And the server logs "wire dropped" with "side=browser cause=peer-closed by=peer code=4000"
    And the browser's "wire dropped" and a server "tab disconnected" name the same socket

  Scenario: The network goes, and what the tab saw meanwhile reaches the log in order
    Given I open the outline "house.olai"
    And the connection is "live"
    When the browser goes offline
    Then the app is frozen under the offline overlay
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    # Posted while the tab could not reach the server too, and tried again
    # until the server takes it: what the tab saw meanwhile arrives in order.
    And the server logs "connection card lifted" with "side=browser status=reconnecting"
    And the browser said "wire dropped", then "connection card shown", then "connection card lifted"

  Scenario: A tab whose socket cannot open still tells the server, and says when it opens again
    # The socket's row switched off in the settings file, because the page
    # cannot switch it back on without a socket.
    Given I open the outline "house.olai"
    And the connection is "live"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"ws-switch","ord":"a0","title":"ws","custom":{"on":"no"}}
      """
    Then the server logs "websocket upgrade had no taker" with "url=/rpc/ws"
    And the server logs "dial did not open" with "side=browser"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"ws-switch","ord":"a0","title":"ws","custom":{"on":"yes"}}
      """
    Then the connection is "live"
    And the server logs "wire opened" with "side=browser"

  Scenario: A line the tab cannot decode is closed by the page, which says what its subscriptions heard
    Given the page's socket runs through a middle
    And I open the outline "house.olai"
    And the connection is "live"
    When the middle sends the page a line that is not JSON
    Then the connection is "live"
    And the server logs "wire dropped" with "side=browser cause=severed by=page"
    And the browser's "wire dropped" heard "RpcClientDefect: Error decoding message"

  Scenario: A frame over the cap is named for what it was
    Given the page's socket runs through a middle
    And I open the outline "house.olai"
    And the connection is "live"
    When the middle sends the page a line one character over the cap
    Then the connection is "live"
    And the server logs "wire dropped" with "side=browser cause=frame-over-cap by=page"

  Scenario: A socket that goes silent is given up on by the heartbeat, about 25 seconds later
    # The heartbeat probes every 15 seconds and waits 10 for an answer, so the
    # verdict takes up to 25 seconds to come; the wait below allows for that.
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    And the connection is "live"
    When I hold incoming updates to the original browser tab
    Then the server logs "heartbeat gave up" with "side=browser" within 60 seconds
    And the server logs "wire dropped" with "side=browser cause=half-open by=page"
    When I release incoming updates to the original browser tab
    Then the connection is "live"

  Scenario: A roster change is olai's own redial, said at debug
    # The serve's level is the file's, so the scenario asks for debug and waits
    # to be told it is in force before it changes anything.
    Given I open the outline "house.olai"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"process-policy","ord":"a0","title":"olai","custom":{"log-level":"debug"}}
      """
    And I open the plugins panel
    And I open the Server section
    Then the Server section reads "log-level" as "debug" from "vault"
    When I switch the plugin "pins" off
    Then the server logs the browser's "wire dropped" at "DEBUG" with a cause among "roster-refresh, redial"

  Scenario: A restarted server hears the tab it retired
    Given I open the outline "house.olai"
    And the connection is "live"
    When the server stops
    And the server starts again on the same port
    Then the server rejected the stale tab
    And the connection is "retired"
    And the server logs "wire retired" with "side=browser"
    And the browser's "wire retired" and the server's "stale tab rejected" name the same tab

  Scenario: A loop is visible without burying the log
    # Eleven drops a second after each socket opens. The first three are said
    # in full, then every tenth; the rest are debug, which a serve at `info`
    # does not print. The redials back off up to five seconds each, so this
    # takes about a minute.
    Given the page's socket runs through a middle
    And I open the outline "house.olai"
    And the connection is "live"
    When the middle drops each socket a second after it opens, 11 times
    Then the server logs "wire dropped" with "side=browser cause=peer-closed streak=10" within 150 seconds
    And the connection is "live"
    And the browser's "wire dropped" lines at full level carry the streaks "1, 2, 3, 10"
