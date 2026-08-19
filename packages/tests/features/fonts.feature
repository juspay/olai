@corpus:good
Feature: The typeface is a pick, and it is yours
  Named typefaces, in the Font row of the preferences panel
  (`preferences.feature`). Picking one writes `data-font` on `<html>`, this
  browser remembers it, and the sheet re-answers `--font-sans`, `--font-serif`
  and `--font-mono` — so one attribute sets the page, the chrome and the
  furniture that has to be tabular.

  The default is Olai — titles in Literata, chrome in iA Writer Quattro,
  code in iA Writer Mono. Atkinson Hyperlegible remains a pick, for a
  page that wants one voice. Generics download nothing; a hosted face is
  fetched only once the pick names it.

  The panel STAYS OPEN on a pick: a face is judged by looking at the page
  it sets. What the row promises — it NAMES the face in force — is kept by
  the row's own hint.

  It is CLIENT state, all of it. Nothing about a pick reaches the server
  except the static `/fonts/*.woff2` a hosted face needs, and a generic
  pick asks for nothing at all.

  Scenario: A fresh browser reads in the default typeface
    When I open the app
    Then the page names no font
    And the font row names the typeface in force
    And the font select is the default

  Scenario: Picking a typeface sets the page
    When I open the app
    And I mark the page
    And I pick the font "inter"
    Then the page is in the font "inter"
    And the font row names the typeface in force
    And the font select is "inter"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The pick is there before the page has finished parsing
    When I open the app
    And I pick the font "inter"
    And I watch for the font landing
    And I reload the page
    Then the font "inter" landed while the page was still parsing
    And the font select is "inter"

  Scenario: Picking the default is a pick like any other
    When I open the app
    And I pick the font "inter"
    And I pick the default font
    Then the page is in the default font
    When I reload the page
    Then the page is in the default font
    And the font select is the default

  Scenario: A stored font nothing offers is forgotten
    When I open the app
    And this browser has stored the font "comic-sans"
    And I reload the page
    Then the page names no font
    And the font select is the default
    And this browser has stored no font

  Scenario: A font picked in another tab lands in this one
    When I open the app
    And a second tab picks the font "inter"
    Then the page is in the font "inter"
    And the font select is "inter"
    And there should be no page errors

  Scenario: Picking a generic font asks the server for nothing
    When I open the app
    And I watch what the page asks for
    And I pick the font "system"
    Then the page is in the font "system"
    And the page asked for nothing at all
