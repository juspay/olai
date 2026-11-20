@share-scratch
@scratch:good
Feature: It stays live
  The files on disk are the state and the page follows them. Nobody reloads and
  nobody presses refresh: the store probes, revalidates, and pushes the next
  snapshot down the subscription the first one arrived on. Every scenario here
  proves the page did NOT reload, because a page that reloaded would pass the
  same assertions while proving nothing.

  These edit the served directory underneath a running server, which is why
  they are `@scratch:`. They share one copy per worker (`@share-scratch`); the
  corpus is restored between scenarios. The scenario that takes the served
  directory away keeps a private copy (`@own-scratch`): restore cannot follow
  a watcher on an inode that is gone.

  Background:
    Given I open the outline "garden.olai"
    And I show the done nodes
    And I mark the page

  Scenario: An edit on disk reaches the open page
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil in trays","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true}
      """
    Then the node "basil" has the title "sow the basil in trays"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A pull that changes several files lands as one set
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true}
      {"id":"compost","parent":"garden","ord":"a1","title":"turn the compost","after":["mint"]}
      """
    And I rewrite "shed.olai" as:
      """
      {"id":"shed","ord":"a0","title":"clear out the shed"}
      {"id":"rake","parent":"shed","ord":"a0","title":"hang up the rake"}
      """
    Then the outline list links to "shed.olai"
    And the outline list has 3 entries
    And the node "compost" is shown
    And the page has not reloaded
    And there should be no page errors

  Scenario: One file that will not parse costs that one outline
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}
      {"id":"order","parent":"kitchen","ord":"a1",title:"order the new cabinets"}
      """
    Then the outline "house.olai" is marked unreadable
    And the stale banner names 1 file
    And the stale banner names "house.olai" as "unparsed"
    And the node "herbs" is shown
    When I open the unreadable outline "house.olai"
    Then the outline failure shows an error at "house.olai:3"
    And the outline failure shows an error with code "not-json"
    And the page has not reloaded

  Scenario: A reference that dangles costs that one outline, and nothing else
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true,"after":["nowhere"]}
      """
    Then the stale banner is shown
    And the stale banner names "garden.olai" as "invalid"
    And the stale banner enumerates nothing
    And the stale banner links to "garden.olai"
    And the stale banner names 1 file
    And the outline "garden.olai" is marked unreadable
    When I open the unreadable outline "garden.olai"
    Then the outline failure shows an error with code "unknown-target"
    And the outline failure shows an error at "garden.olai:4"
    When I click the outline "house.olai"
    Then the node "install" is shown
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint at last","doing":true}
      """
    Then the stale banner is gone
    And the node "mint" has the title "split the mint at last"
    And the page has not reloaded
    And there should be no page errors

  @own-scratch
  Scenario: A directory that stops being readable says so, over the tree it left
    When the served directory is taken away
    # macOS delivers no watch event for the served root going away, so the
    # unconditional sweep is what notices it.
    Then the stale banner eventually appears
    And the stale banner names "." as "unreadable"
    And the stale banner says "olai can't read this folder right now"
    And the node "herbs" is shown
    And the page has not reloaded

  Scenario: A record spliced into the middle of a file appears, once
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint"}
      {"id":"beds","parent":"garden","ord":"a1","title":"the raised beds"}
      {"id":"peas","parent":"beds","ord":"a0","title":"stake the peas"}
      {"id":"beans","parent":"beds","ord":"a1","title":"sow the beans"}
      {"id":"compost","parent":"garden","ord":"a2","title":"turn the compost"}
      """
    Then the outline "garden.olai" shows exactly the nodes "garden, herbs, basil, mint, beds, peas, beans, compost"
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint"}
      {"id":"chives","parent":"herbs","ord":"a2","title":"divide the chives"}
      {"id":"beds","parent":"garden","ord":"a1","title":"the raised beds"}
      {"id":"peas","parent":"beds","ord":"a0","title":"stake the peas"}
      {"id":"beans","parent":"beds","ord":"a1","title":"sow the beans"}
      {"id":"compost","parent":"garden","ord":"a2","title":"turn the compost"}
      """
    Then the outline "garden.olai" shows exactly the nodes "garden, herbs, basil, mint, chives, beds, peas, beans, compost"
    And the node "chives" has the title "divide the chives"
    And the page has not reloaded

  Scenario: A record deleted from the middle goes, and takes nothing with it
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint"}
      {"id":"beds","parent":"garden","ord":"a1","title":"the raised beds"}
      {"id":"peas","parent":"beds","ord":"a0","title":"stake the peas"}
      {"id":"beans","parent":"beds","ord":"a1","title":"sow the beans"}
      {"id":"compost","parent":"garden","ord":"a2","title":"turn the compost"}
      """
    Then the outline "garden.olai" shows exactly the nodes "garden, herbs, basil, mint, beds, peas, beans, compost"
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}
      {"id":"beds","parent":"garden","ord":"a1","title":"the raised beds"}
      {"id":"peas","parent":"beds","ord":"a0","title":"stake the peas"}
      {"id":"beans","parent":"beds","ord":"a1","title":"sow the beans"}
      {"id":"compost","parent":"garden","ord":"a2","title":"turn the compost"}
      """
    Then the outline "garden.olai" shows exactly the nodes "garden, herbs, basil, beds, peas, beans, compost"
    And the page has not reloaded

  Scenario: A file rewritten in a different order still says the same thing
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint"}
      {"id":"beds","parent":"garden","ord":"a1","title":"the raised beds"}
      {"id":"peas","parent":"beds","ord":"a0","title":"stake the peas"}
      {"id":"beans","parent":"beds","ord":"a1","title":"sow the beans"}
      {"id":"compost","parent":"garden","ord":"a2","title":"turn the compost"}
      """
    Then the outline "garden.olai" shows exactly the nodes "garden, herbs, basil, mint, beds, peas, beans, compost"
    When I rewrite "garden.olai" as:
      """
      {"id":"compost","parent":"garden","ord":"a2","title":"turn the compost"}
      {"id":"beans","parent":"beds","ord":"a1","title":"sow the beans"}
      {"id":"peas","parent":"beds","ord":"a0","title":"stake the peas"}
      {"id":"beds","parent":"garden","ord":"a1","title":"the raised beds"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      """
    Then the outline "garden.olai" shows exactly the nodes "garden, herbs, basil, mint, beds, peas, beans, compost"
    And the node "basil" has the title "sow the basil"
    And the node "mint" has the title "split the mint"
    And the node "peas" has the title "stake the peas"
    And the node "beans" has the title "sow the beans"
    And the page has not reloaded

  Scenario: A middle insert does not poison the edits after it
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint"}
      {"id":"beds","parent":"garden","ord":"a1","title":"the raised beds"}
      {"id":"peas","parent":"beds","ord":"a0","title":"stake the peas"}
      {"id":"beans","parent":"beds","ord":"a1","title":"sow the beans"}
      {"id":"compost","parent":"garden","ord":"a2","title":"turn the compost"}
      """
    Then the outline "garden.olai" shows exactly the nodes "garden, herbs, basil, mint, beds, peas, beans, compost"
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}
      {"id":"chives","parent":"herbs","ord":"a2","title":"divide the chives"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint"}
      {"id":"beds","parent":"garden","ord":"a1","title":"the raised beds"}
      {"id":"peas","parent":"beds","ord":"a0","title":"stake the peas"}
      {"id":"beans","parent":"beds","ord":"a1","title":"sow the beans"}
      {"id":"compost","parent":"garden","ord":"a2","title":"turn the compost"}
      """
    And I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}
      {"id":"chives","parent":"herbs","ord":"a2","title":"divide the chives"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint"}
      {"id":"beds","parent":"garden","ord":"a1","title":"the raised beds"}
      {"id":"peas","parent":"beds","ord":"a0","title":"stake the peas"}
      {"id":"beans","parent":"beds","ord":"a1","title":"sow the beans"}
      {"id":"compost","parent":"garden","ord":"a2","title":"turn the compost"}
      {"id":"leaves","parent":"compost","ord":"a0","title":"rake the leaves in"}
      """
    Then the outline "garden.olai" shows exactly the nodes "garden, herbs, basil, mint, chives, beds, peas, beans, compost, leaves"
    And the page has not reloaded
    And there should be no page errors

  Scenario: An outline that arrives beside the open one leaves it whole
    When I rewrite "shed.olai" as:
      """
      {"id":"shed","ord":"a0","title":"clear out the shed"}
      {"id":"rake","parent":"shed","ord":"a0","title":"hang up the rake"}
      """
    Then the outline list links to "shed.olai"
    And the outline list has 3 entries
    And the outline "garden.olai" shows exactly the nodes "garden, herbs, basil, mint, frames, glazing, sowing, slugs, compost, turned, straw"
    And the node "basil" has the title "sow the basil"
    And the page has not reloaded
    And there should be no page errors

  Scenario: An outline whose name carries a quote arrives like any other
    When I rewrite "say \"hi\".olai" as:
      """
      {"id":"quoted","ord":"a0","title":"an outline nobody could grip"}
      """
    Then the outline list links to "say \"hi\".olai"
    And the outline list has 3 entries
    And the page has not reloaded
    And there should be no page errors

  Scenario: A FILTERED page follows the files too, in both directions
    When I filter the page by "trays"
    Then the filter found "1 of 11"
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door","doing":"2026-07-20"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil in trays","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint into trays","doing":true}
      """
    Then the filter found "2 of 4"
    And the node "basil" is a match
    And the node "mint" is a match
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door","doing":"2026-07-20"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true}
      """
    Then the filter found "No matches of 4"
    And the node "basil" is not shown
    And the page has not reloaded
    And there should be no page errors

  Scenario: A zoomed node's own page is as live as its outline
    When I zoom into the node "herbs"
    And I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil in trays","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true}
      """
    Then the zoomed node is "herbs"
    And the node "basil" has the title "sow the basil in trays"
    And the page has not reloaded
    And there should be no page errors
