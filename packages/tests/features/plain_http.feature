Feature: Reading olai from another machine over plain http
  Most people read olai from another machine — a LAN address, a tailscale
  port — over plain http. That page is not a secure context, and the browser
  withholds `crypto.randomUUID` and `navigator.clipboard` from it. The app has
  to come up and work there all the same.

  Background:
    Given I read olai from another machine over plain http

  Scenario: The app comes up, and a second pane opens beside the first
    Given I open the outline "house.olai"
    Then this page is not a secure context
    When I alt-click the zoom of "install"
    Then there are 2 panes
    And pane 1 is focused
    And there should be no page errors

  Scenario: A tab's address is offered to copy by hand
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I choose "Copy address" from the menu of tab 1
    Then the page offers the link to "/garden.olai" to copy by hand
    And there are 2 tabs
    And there should be no page errors
