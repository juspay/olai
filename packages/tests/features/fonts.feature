@corpus:good
Feature: The typeface is a pick, and it is yours
  Named typefaces share the preference circuit `theming.feature` already pins
  — default, persist, no-flash, another tab. What is unique here is the fetch:
  a hosted face needs `/fonts/*.woff2`, and a generic pick asks for nothing at
  all. The catalog and the boot script are `theme/fonts.test.ts`.

  Scenario: Picking a generic font asks the server for nothing
    When I open the app
    And I watch what the page asks for
    And I pick the font "system"
    Then the page is in the font "system"
    And the page asked for nothing at all
