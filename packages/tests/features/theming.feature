@corpus:good
Feature: The theme is a pick, and it is yours
  Fifteen named palettes behind a pill in the app header. Pressing one writes `data-theme` on
  `<html>`, this browser remembers it, and the sheet repaints — every colour on
  the page is a custom property, so one attribute re-answers all of them at
  once.

  It is CLIENT state, all of it. Nothing about a pick reaches the server: it is
  stored in this browser, the same way the agent drawer's open state is, so two
  machines reading the same outlines are entitled to look different and the
  served directory neither knows nor cares. That is what the last two scenarios
  are about, and they are worth having because "it works" and "it works without
  asking anybody" look identical on screen.

  There is no "system" chip. The OS's preference used to choose the palette,
  which meant two ways to be dark that could disagree, and a page that changed
  under a reader who had already said what they wanted. A page that has picked
  nothing reads in the default — `chalk`, the one palette that promises AA — so
  the page nobody chose for is the legible one.

  The scenario about parsing is the one that catches the regression that
  matters. Everything on this page is deferred; a theme restored by the bundle
  would land after the first paint, which is a flash of the wrong colours on
  every single load. Four lines in `<head>` are what prevent it, and nothing
  else on the page can.

  Scenario: A fresh browser reads in the default theme
    When I open the app
    Then the page names no theme
    And the theme trigger names the theme in force
    And the lit theme chip is the default
    And every theme chip agrees with what it announces

  Scenario: Picking a theme repaints the page
    When I open the app
    And I note the paper colour
    And I mark the page
    And I pick the theme "pitch"
    Then the page is in the theme "pitch"
    And the theme trigger names the theme in force
    And the theme popover is shut
    And the lit theme chip is "pitch"
    And the paper colour has changed
    And the page has not reloaded
    And there should be no page errors

  Scenario: The pick is there before the page has finished parsing
    When I open the app
    And I pick the theme "pitch"
    And I watch for the theme landing
    And I reload the page
    Then the theme "pitch" landed while the page was still parsing
    And the lit theme chip is "pitch"

  Scenario: Picking the default is a pick like any other
    # Stored explicitly rather than by falling back to it: otherwise "chalk"
    # would mean two different things, and a later change of default would
    # silently move everybody who had chosen the old one.
    When I open the app
    And I pick the theme "pitch"
    And I pick the default theme
    Then the page is in the default theme
    When I reload the page
    Then the page is in the default theme
    And the lit theme chip is the default

  Scenario: A stored theme nothing offers is forgotten
    # What a value stored by an older olai looks like after a theme is renamed
    # or dropped. The sheet has no block for it, so a page left holding one
    # would sit on the default's colours while claiming to be in something
    # else — and no chip would be lit.
    When I open the app
    And this browser has stored the theme "burnt-umber"
    And I reload the page
    Then the page names no theme
    And the lit theme chip is the default
    And this browser has stored no theme

  Scenario: A theme picked in another tab lands in this one
    # A preference belongs to the BROWSER, and a browser is more than one tab.
    # Two tabs on the same outlines are one browser and one theme, so a sibling
    # left in the old palette until somebody reloads it is the one stale thing
    # on the screen — on a page whose whole promise is that it does not need
    # reloading. Nothing about this reaches the server either: the browser's own
    # `storage` event is what crosses.
    When I open the app
    And a second tab picks the theme "pitch"
    Then the page is in the theme "pitch"
    And the lit theme chip is "pitch"
    And there should be no page errors

  Scenario: The browser chrome follows the paper
    # The status bar on a phone, the title bar of an installed window. The
    # shell ships the default's paper, so it is right on the first paint; a
    # page that picked repaints it from the same table that painted the page.
    When I open the app
    Then the browser chrome matches the paper
    When I pick the theme "matcha"
    Then the browser chrome matches the paper

  Scenario: The manifest opens the app in the paper an unpicked page paints
    # The manifest is the SERVER's and the palettes are the CLIENT's, and the
    # two packages do not import each other — so the only honest way to ask
    # whether they still agree is to fetch one and measure the other.
    When I open the app
    Then the manifest's chrome is the paper this page paints

  Scenario: Picking a theme asks the server for nothing
    When I open the app
    And I watch what the page asks for
    And I pick the theme "hacker"
    Then the page is in the theme "hacker"
    And the page asked for nothing at all
