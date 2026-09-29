@corpus:good
Feature: The theme is a pick, and it is yours
  Named palettes, as eighteen swatches in the Theme row of the preferences panel
  (`preferences.feature`) — each painted in its own paper with a wedge of its
  accent, lights first, then darks. Pressing one writes `data-theme` on
  `<html>`, this browser remembers it, and the sheet repaints — every colour on
  the page is a custom property, so one attribute re-answers all of them at
  once. A swatch carries no word; its name is its tooltip and its accessible
  name, and a keyboard reaches it with Tab and picks it with Space or Enter.

  The panel STAYS OPEN on a pick, unlike the pill-and-popover this row replaced:
  a palette is judged by looking at the page it paints, and shutting the surface
  after every press would make comparing two of them a matter of reopening it.
  What that pill promised — it NAMED the theme in force — is kept by the name
  drawn beside the row's label, which is what "the theme row names the theme
  in force" asserts.

  It is CLIENT state, all of it. Nothing about a pick reaches the server: it is
  stored in this browser, the same way the agent drawer's open state is, so two
  machines reading the same outlines are entitled to look different and the
  served directory neither knows nor cares. That is what the last two scenarios
  are about, and they are worth having because "it works" and "it works without
  asking anybody" look identical on screen.

  The network measurement starts after the picker is open and its fonts have
  loaded. Opening that surface and loading the initial page are separate from
  choosing a palette; every request made by the pick still counts.

  There is no "system" chip. The OS's preference used to choose the palette,
  which meant two ways to be dark that could disagree, and a page that changed
  under a reader who had already said what they wanted. A page that has picked
  nothing reads in the default — `reef`, the lagoon — so the page nobody
  chose for is the one that is ours. `chalk` is still a pick, and still the
  one palette that promises AA.

  The scenario about parsing is the one that catches the regression that
  matters. Everything on this page is deferred; a theme restored by the bundle
  would land after the first paint, which is a flash of the wrong colours on
  every single load. Four lines in `<head>` are what prevent it, and nothing
  else on the page can.

  Scenario: A fresh browser reads in the default theme
    When I open the app
    Then the page names no theme
    And the theme row names the theme in force
    And the lit theme chip is the default
    And every theme chip agrees with what it announces

  Scenario: Picking a theme repaints the page
    When I open the app
    And I note the paper colour
    And I mark the page
    And I pick the theme "pitch"
    Then the page is in the theme "pitch"
    And the theme row names the theme in force
    And the lit theme chip is "pitch"
    And the paper colour has changed
    And the page has not reloaded
    And there should be no page errors

  Scenario: Every palette paints the page it names
    # The sheet is generated from the table, one block per row, and this is
    # the round trip: pick each of the eighteen and read the page's own paper
    # back. A row whose block was dropped, mistyped, or given another row's
    # values fails here, in the browser that paints it.
    When I open the app
    Then every palette paints the page it names

  Scenario: A keyboard picks a swatch, and the caret stays where it was
    # Tab reaches the swatches (they are the panel's first controls), Space
    # and Enter each press one, and the panel stays open with the caret still
    # on the swatch just pressed — so the next arrow of Tabs starts from there,
    # not from the top of the page.
    When I open the app
    And I open the preferences
    And I Tab to the "pitch" swatch
    And I press "Space"
    Then the page is in the theme "pitch"
    And the lit theme chip is "pitch"
    And the theme row names the theme in force
    And the "pitch" swatch has the focus
    When I Tab to the "ember" swatch
    And I press "Enter"
    Then the page is in the theme "ember"
    And the theme row names the theme in force
    And the "ember" swatch has the focus
    And every theme chip agrees with what it announces
    And there should be no page errors

  Scenario: The pick is there before the page has finished parsing
    When I open the app
    And I pick the theme "pitch"
    And I watch for the theme landing
    And I reload the page
    Then the theme "pitch" landed while the page was still parsing
    And the lit theme chip is "pitch"

  Scenario: Picking the default is a pick like any other
    # Stored explicitly rather than by falling back to it: otherwise the
    # default's name would mean two different things, and a later change of
    # default would silently move everybody who had chosen the old one.
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

  Scenario: The browser chrome follows the paper
    # The status bar on a phone, the title bar of an installed window, and the
    # tab's own mark. The shell ships the default's paper, so the status bar is
    # right on the first paint; the tab starts as the install file. A page that
    # picked (and the default, once the bundle is up) repaints both from the
    # same table that painted the page.
    When I open the app
    Then the browser chrome matches the paper
    When I pick the theme "bloom"
    Then the browser chrome matches the paper

  Scenario: The manifest opens the app in the paper an unpicked page paints
    # The manifest is the SERVER's and the palettes are the CLIENT's, and the
    # two packages do not import each other — so the only honest way to ask
    # whether they still agree is to fetch one and measure the other.
    When I open the app
    Then the manifest's chrome is the paper this page paints

  Scenario: Picking a theme asks the server for nothing
    When I open the app
    And the appearance controls have finished loading their fonts
    And I watch what the page asks for
    And I pick the theme "ember"
    Then the page is in the theme "ember"
    And the page asked for nothing at all
