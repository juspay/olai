@scratch:good
Feature: The matcher is a plugin
  Search is a row. A serve that does not name it keeps the grammar, the
  `search_nodes` tool and every box a person types into — and has no matcher
  behind any of them. That is "no provider mounted": no hits, and the reason,
  in words. It is not an empty directory, and it is not a box that went quiet.

  The header's box is the row's OWN face, so with the row absent there is no
  box at all. The ⌘K palette is CORE's and still draws — the shortlist under it
  is furniture four core doors share — so what it has to do instead is say why
  it found nothing, which is the half the unit case at the MCP door cannot
  reach: nothing there drives a tab.

  @plugins:chat,claude,git
  Scenario: A serve that did not name search has no box, and its palette says why
    When I open the app
    Then the header has no search box
    # The palette opens as it always did, and asks as it always did. What is
    # behind the door is gone, so the answer carries the refusal every one of
    # these doors already draws for a query the grammar could not read — spent
    # here on a serve that has no matcher to read it with.
    When I press the palette shortcut
    And I type "cabinets" into the palette
    Then the search refuses "cabinets" and says "no matcher"
    And there should be no page errors

  Scenario: Switching the row off takes the box out of the bar while you watch
    # THE FLIP, on the half a unit test cannot reach. The box is a face in the
    # bar's `lead` seat, so it leaves the way any plugin's face leaves — and
    # the table leaves with the fiber that opened it.
    When I open the app
    And I search the header for "cabinets"
    Then the header search lists the node "order the new cabinets"
    When I open the plugins panel
    And I switch the plugin "search" off
    Then the header has no search box
    # ...and back, in the same process. What comes back is a FRESH table, built
    # level with the next reading it is handed — which is why the same query
    # finds the same node again and nothing had to be invalidated.
    When I switch the plugin "search" on
    And I search the header for "cabinets"
    Then the header search lists the node "order the new cabinets"
    And there should be no page errors
