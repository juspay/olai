@scratch:good
@plugins:test-counter,ws,web-app,ui-renderer
Feature: The host serves a non-notebook capability
  This exact plugin selection contains no vault, outlines, Markdown or file
  capabilities. The fixture supplies its own tiny shell through the renderer.

  Scenario: A browser uses server state without a notebook
    When I open the browser before an application can mount
    Then the non-notebook fixture shows counter 0
    When I increment the non-notebook counter
    Then the non-notebook fixture shows counter 1
    When I reload the non-notebook fixture
    Then the non-notebook fixture shows counter 1
    And there should be no page errors
