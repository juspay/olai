@corpus:good
Feature: Install it
  olai is a page you can add to a home screen or a dock: a manifest that says
  what the app is called and what it looks like, and the mark itself in the
  sizes the platforms ask for.

  What makes these scenarios worth having is how this can break silently. The
  manifest is the SERVER's (it is served, not a file in the bundle) and the
  icons are the BUNDLE's (files copied to the dist root by the build), and the
  two packages never import each other — so a renamed icon leaves a manifest
  naming a URL that no longer exists. Worse, the static layer answers an
  unmatched path with the HTML shell, so that URL still returns 200: only the
  content type says anything is wrong, which is exactly what is asserted here.

  There is no offline mode and no service worker. This app is live or nothing —
  a cached shell would show outlines that stopped being true — so the last
  scenario pins that too.

  Scenario: The manifest says what this app is
    Then "/manifest.webmanifest" is served as "application/manifest+json"
    And the manifest is named "olai"
    And the manifest opens "/" as a "standalone" app

  Scenario: Every icon the manifest names is really served
    # The whole cross-package contract, asserted the way an installer would
    # find it out: follow every `src` and check what comes back.
    Then the manifest names 4 icons
    And every icon the manifest names is served as the type it claims
    And the manifest offers a maskable icon

  Scenario: The shell names the mark for what reads no manifest
    # iOS's Add to Home Screen and the browser tab both ignore the manifest,
    # so the same mark is named again in the shell.
    When I open the app
    Then the page's "icon" is "/icon.svg"
    And the page's "apple-touch-icon" is "/apple-touch-icon.png"
    And "/icon.svg" is served as "image/svg+xml"
    And "/apple-touch-icon.png" is served as "image/png"

  Scenario: The page asks to be laid out for the screen it is on
    When I open the app
    Then the page is laid out for the device width

  Scenario: Installable, but never offline
    When I open the app
    Then no service worker is registered
