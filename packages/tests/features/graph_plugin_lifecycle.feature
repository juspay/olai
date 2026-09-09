Feature: The graph is one optional row
  Everything the map draws is the row's — sidebar door, row verb, palette
  entry, page — so switching the row off switches it all off, and switching
  it back on returns it on one page that never reloaded. The evidence is
  that the same page keeps answering afterwards.

  @share-scratch
  @scratch:good
  @without-plugins:graph
  Scenario: A serve without graph is an outliner with no map
    Given I open the outline "house.olai"
    # The sidebar's door table has no graph row at all.
    Then the graph door is not drawn below the files
    When I open the reference graph
    # No content provider claims /graph, so no route settles it either: the
    # pane falls back to the outliner's own home rather than a dead chair.
    Then the graph page is not shown
    When I zoom into the node "install"
    Then the node page names no reference graph door
    When I go back
    And I open the outline "garden.olai"
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
    # With the row withdrawn the picture is the first thing gone — and with
    # it the address's claimant, so the pane comes home to the outliner on
    # the same page, never reloaded.
    Then the graph page is not shown
    And the graph door is not drawn below the files
    And the page has not reloaded
    When I switch the plugin "graph" on
    And I close the plugins panel
    And I open the reference graph around "#herbs"
    Then the graph is at 1 hops
    And the graph shows the dot "#order"
    And the page has not reloaded
    And there should be no page errors
