@browsing @browsing-live @scratch:chat
Feature: The person sees and uses the browser their agents use
  olai runs one real, headless Chromium per served directory. Every
  conversation's Playwright MCP attaches to it, and the /browser pane shows its
  tabs live and lets the person click, type, paste and navigate in them — so a
  sign-in the person makes there is the agents' sign-in too.

  These scenarios run the pinned Chromium and the real Playwright MCP from the
  e2e shell. The pages it visits are served on loopback by the scenario.

  Background:
    Given the harness keeps distinct sessions on disk
    And a web site the browser can visit
    And I open the outline "house.olai"

  Scenario: Open the pane from the health popover, start the browser and drive a page by hand
    When I open the health popover
    And I press the browser row in the health popover
    Then pane 0 draws the browser page
    And the address is "/browser"
    And the browser pane says the browser is down
    And the browser pane says "The browser is not running."
    When I start the browser from the pane
    Then the browser pane says the browser is up
    And the browser runs within its own sandbox
    And the browser pane shows 1 tab
    When I go to the site's "fixture" page in the browser's address bar
    Then the shown browser tab in pane 0 is titled "Fixture"
    And the browser's address bar shows the site's "fixture" page
    And pane 0 draws a picture of the page
    When I note the picture in pane 0
    And I press the page's button through pane 0
    Then the shown browser tab in pane 0 is titled "clicked"
    And the picture in pane 0 changes
    When I type "hello" into the page's box through pane 0
    Then keys in pane 0 go to the page
    And the shown browser tab in pane 0 is titled "typed:hello"
    When I paste " world" into pane 0
    Then the shown browser tab in pane 0 is titled "typed:hello world"
    When I press Escape in the browser pane
    Then keys in pane 0 go to the app
    When I open a new browser tab from the pane
    Then the browser pane shows 2 tabs
    And the address is a browser tab's own
    When I close the browser tab titled "typed:hello world"
    Then the browser pane shows 1 tab
    And there should be no page errors

  Scenario: The palette opens the pane, a second pane watches the same tab, and closing one keeps the other live
    When I press the palette shortcut
    And I type "open browser" into the palette
    And I press "Enter"
    Then pane 0 draws the browser page
    And the browser pane says the browser is down
    When I start the browser from the pane
    And I go to the site's "fixture" page in the browser's address bar
    Then the shown browser tab in pane 0 is titled "Fixture"
    When I Alt-press the browser tab titled "Fixture" in pane 0
    Then there are 2 panes
    And pane 1 draws the browser page
    And pane 0 draws a picture of the page
    And pane 1 draws a picture of the page
    When I note the picture in pane 0
    And I press the page's button through pane 1
    Then the shown browser tab in pane 0 is titled "clicked"
    And the picture in pane 0 changes
    When I focus pane 1
    And I close the focused pane
    Then there are 1 panes
    When I note the picture in pane 0
    And I type "still live" into the page's box through pane 0
    Then the shown browser tab in pane 0 is titled "typed:still live"
    And the picture in pane 0 changes
    And there should be no page errors

  Scenario: Two panes on two different tabs both stay live, whichever was used last
    # Every tab lives in one headless window, where only the front tab is
    # visible and a background tab paints nothing. Each pane must keep its
    # own tab's picture moving anyway, in either order of use.
    When I open the address "/browser"
    And I start the browser from the pane
    And I go to the site's "fixture" page in the browser's address bar
    Then the shown browser tab in pane 0 is titled "Fixture"
    When I open a new browser tab from the pane
    Then the browser pane shows 2 tabs
    When I go to the site's "second" page in the browser's address bar
    Then the shown browser tab in pane 0 is titled "Second"
    When I Alt-press the browser tab titled "Fixture" in pane 0
    Then there are 2 panes
    And the shown browser tab in pane 1 is titled "Fixture"
    And pane 0 draws a picture of the page
    And pane 1 draws a picture of the page
    When I note the picture in pane 1
    And I press the page's button through pane 1
    Then the shown browser tab in pane 1 is titled "clicked"
    And the picture in pane 1 changes
    When I note the picture in pane 0
    And I press the page's button through pane 0
    Then the shown browser tab in pane 0 is titled "second clicked"
    And the picture in pane 0 changes
    When I note the picture in pane 1
    And I type "back" into the page's box through pane 1
    Then the shown browser tab in pane 1 is titled "typed:back"
    And the picture in pane 1 changes
    When I note the picture in pane 0
    And I type "front" into the page's box through pane 0
    Then the shown browser tab in pane 0 is titled "second typed:front"
    And the picture in pane 0 changes
    And there should be no page errors

  Scenario: The person's tab and an agent's tab, side by side, both stay live
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent to open the site's "agent" page with its browser tools
    Then the agent's answer mentions "Agent page"
    When I press the chat's browser chip
    Then pane 0 draws the browser page
    # The agent's MCP took the browser's first, blank tab; the person opens
    # one of their own beside it.
    And the browser pane shows 1 tab
    When I open a new browser tab from the pane
    Then the browser pane shows 2 tabs
    When I go to the site's "fixture" page in the browser's address bar
    Then the shown browser tab in pane 0 is titled "Fixture"
    When I Alt-press the browser tab titled "Agent page" in pane 0
    Then there are 2 panes
    And the shown browser tab in pane 1 is titled "Agent page"
    And pane 0 draws a picture of the page
    And pane 1 draws a picture of the page
    When I note the picture in pane 0
    And I press the page's button through pane 0
    Then the shown browser tab in pane 0 is titled "clicked"
    And the picture in pane 0 changes
    When I note the picture in pane 1
    And I press the page's button through pane 1
    Then the shown browser tab in pane 1 is titled "agent clicked"
    And the picture in pane 1 changes
    When I note the picture in pane 0
    And I type "mine" into the page's box through pane 0
    Then the shown browser tab in pane 0 is titled "typed:mine"
    And the picture in pane 0 changes
    And there should be no page errors

  @browsing-live-unsandboxed
  Scenario: When the container is the sandbox, the browser starts without its own and streams
    # The container-is-the-sandbox deployment: OLAI_BROWSER_CHROMIUM_SANDBOX
    # is `container`, so Chromium is launched with the flags the hermetic check uses.
    # Everywhere else in this file it runs inside its own sandbox.
    When I open the address "/browser"
    And I start the browser from the pane
    Then the browser pane says the browser is up
    And the browser runs without its own sandbox
    When I go to the site's "fixture" page in the browser's address bar
    Then pane 0 draws a picture of the page
    When I note the picture in pane 0
    And I press the page's button through pane 0
    Then the shown browser tab in pane 0 is titled "clicked"
    And the picture in pane 0 changes
    And there should be no page errors

  Scenario: An agent's browser tools attach to the person's browser, and the roster chip leads to it
    # The agent's own Playwright MCP is the real one, handed `--cdp-endpoint`
    # at session open: its page lands in the person's tab strip, and its
    # `browser_close` lets go of the browser without closing it.
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the panel says this conversation has "browser"
    And the chat's browser chip links to the browser pane
    When I ask the agent to open the site's "agent" page with its browser tools
    Then the agent's answer mentions "Agent page"
    When I ask the agent to close its browser
    Then the agent is idle
    When I press the chat's browser chip
    Then pane 0 draws the browser page
    And the address is "/browser"
    And the browser pane says the browser is up
    And a browser tab in pane 0 is titled "Agent page"
    And there should be no page errors

  Scenario: What a page keeps survives olai restarting, until the person forgets the sign-ins
    When I open the address "/browser"
    And I start the browser from the pane
    And I go to the site's "remember" page in the browser's address bar
    Then the shown browser tab in pane 0 is titled "kept:nothing"
    When I press the page's button through pane 0
    Then the shown browser tab in pane 0 is titled "kept:signed-in"
    When I remember the browser's process
    And the server stops
    Then the remembered browser process is gone
    When the server starts again on the same port
    And I reload from the overlay
    And I open the address "/browser"
    Then the browser pane says the browser is down
    When I start the browser from the pane
    And I go to the site's "remember" page in the browser's address bar
    Then the shown browser tab in pane 0 is titled "kept:signed-in"
    When I forget the browser's sign-ins
    Then the browser pane says the browser is down
    When I start the browser from the pane
    And I go to the site's "remember" page in the browser's address bar
    Then the shown browser tab in pane 0 is titled "kept:nothing"
    And there should be no page errors

  Scenario: Switching the row off stops the browser; on again and Start relaunches it
    When I open the address "/browser"
    And I start the browser from the pane
    Then the browser pane says the browser is up
    When I remember the browser's process
    And I mark the page
    And the settings file switches the row "browsing" off
    Then no browser page is drawn
    And the remembered browser process is gone
    When the settings file switches the row "browsing" on
    Then pane 0 draws the browser page
    And the browser pane says the browser is down
    When I start the browser from the pane
    Then the browser pane says the browser is up
    And the browser runs as a different process
    And the page has not reloaded
    And there should be no page errors

  Scenario: The pane keeps streaming across a dropped connection
    When I open the address "/browser"
    And I start the browser from the pane
    And I go to the site's "fixture" page in the browser's address bar
    Then pane 0 draws a picture of the page
    When I mark the page
    And the browser goes offline
    Then the connection is "reconnecting"
    When the browser comes back online
    Then the connection is "live"
    When I note the picture in pane 0
    And I press the page's button through pane 0
    Then the shown browser tab in pane 0 is titled "clicked"
    And the picture in pane 0 changes
    And the page has not reloaded
    And there should be no page errors
