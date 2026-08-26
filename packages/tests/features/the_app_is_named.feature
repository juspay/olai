@corpus:good
Feature: The app is named after its machine

  An olai names itself after the box it serves: `olai [machine]`. The box's
  name is a fact about the PROCESS — a browser cannot know its server's
  `os.hostname()` — so it crosses on the surface socket (`app.get`), the way
  who is looking crosses, and the one spelling of it (`@olai/surface`'s
  `appName`) is what the tab's title, the header's wordmark and the install
  manifest's `name` all draw. One person runs olai on a laptop and a NUC;
  untitled by machine, their tabs and their installed apps are identical,
  and "which olai is this" is guessing. That is the whole feature.

  The harness pins the machine's word (OLAI_HOSTNAME, hooks.ts's BOX_NAME),
  so the crossing is asserted against a KNOWN name rather than against
  whatever container the run happened in — and a server somebody else owns
  (OLAI_URL) is checked for the same shape against its own manifest.

  Scenario: The tab, the wordmark and the manifest carry the box's name
    When I open the app
    Then the install manifest names the app after its box
    And the tab is titled what the manifest names the app
    And the wordmark says what the manifest names the app
    And I save a screenshot as "app-named.png"
    And there should be no page errors
