@scratch:good
Feature: Open media pages follow replaced and restored files
  Scenario: Replacing and restoring an image loads the new bytes without reloading the app
    Given I rewrite "art/live.svg" as:
      """
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="16"><rect width="24" height="16" fill="red"/></svg>
      """
    And I open the address "/art/live.svg"
    And I mark the page
    Then the picture's natural size is 24 by 16
    When I rewrite "art/live.svg" as:
      """
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="32"><rect width="48" height="32" fill="blue"/></svg>
      """
    Then the picture's natural size is 48 by 32
    When I remove the served file "art/live.svg"
    Then the main pane says there is no image "art/live.svg"
    When I rewrite "art/live.svg" as:
      """
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="40"><rect width="64" height="40" fill="green"/></svg>
      """
    Then the picture's natural size is 64 by 40
    And this file has no editor
    And the page has not reloaded
    And there should be no page errors

  Scenario: Replacing a truncated CSV removes its old rows and truncation notice
    Given a csv of 700 data rows exists at "data/live.csv"
    And I open the address "/data/live.csv"
    And I mark the page
    Then the table draws 499 rows under the header
    And the csv page says "Showing the first 500 rows."
    When I rewrite "data/live.csv" as:
      """
      product,note
      hinges,"new, smaller export"
      """
    Then the table's header is "product, note"
    And the table's row 1 is "hinges|new, smaller export"
    And the table draws 1 rows under the header
    And the csv page says nothing was left out
    And this file has no editor
    And the page has not reloaded
    And there should be no page errors

  Scenario: A missing CSV returns as a usable table with the restored content
    Given I open the address "/data/sales.csv"
    And I mark the page
    When I remove the served file "data/sales.csv"
    Then the main pane says there is no csv "data/sales.csv"
    When I rewrite "data/sales.csv" as:
      """
      replacement,count
      restored,9
      """
    Then the table's header is "replacement, count"
    And the table's row 1 is "restored|9"
    And the table draws 1 rows under the header
    And the page has not reloaded
    And there should be no page errors

  Scenario: A missing HTML preview returns with the restored page
    Given I rewrite "live.html" as:
      """
      <h1>Before removal</h1>
      """
    And I open the address "/live.html"
    And I mark the page
    Then the preview shows the heading "Before removal"
    When I remove the served file "live.html"
    Then the main pane says there is no page "live.html"
    When I rewrite "live.html" as:
      """
      <h1>Restored preview</h1>
      """
    Then the preview shows the heading "Restored preview"
    And this file has no editor
    And the page has not reloaded
    And there should be no page errors
