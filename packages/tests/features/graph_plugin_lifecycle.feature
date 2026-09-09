Feature: The graph is one optional row
  Everything the map draws is the row's — sidebar door, row verb, palette
  entry, page — so switching the row off switches it all off, and switching
  it back on returns it on one page that never reloaded. The evidence is
  that the same page keeps answering afterwards.

  @share-scratch
  @scratch:good
  @plugins:vault,chat,ws,web-app,mcp,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,outlines,markdown,files,pins,capture,trash,vault-plugins
  Scenario: A serve without graph is an outliner with no map
    Given I open the outline "house.olai"
    # The whole door table at once — and both faces of it.
    When I open the reference graph
    # No content provider claims /graph, so no route settles it either: the
    # pane falls back to the outliner's own home rather than a dead chair.
    Then the outline list is shown
    When I open the outline "garden.olai"
    And I open the node menu of "herbs"
    Then the node menu does not offer "Reference graph"
    When I press the palette shortcut
    Then the palette does not offer "Go to the graph"
    And there should be no page errors

  @share-scratch
  @scratch:good
  Scenario: Flipping the row exchanges the picture for the outliner, without a reload
    Given I open the reference graph around "#herbs"
    And I mark the page
    And the graph shows the dot "#order"
    When I open the plugins panel
    And I switch the plugin "graph" off
    # With the row withdrawn the address has no claimant: the pane comes
    # home to the outliner, the page itself never reloaded.
    Then the outline list is shown
    And the page has not reloaded
    When I switch the plugin "graph" on
    And I close the plugins panel
    Then the graph is at 1 hops
    And the graph shows the dot "#order"
    And the page has not reloaded
    And there should be no page errors
