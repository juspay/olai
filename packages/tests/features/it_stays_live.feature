@scratch:good
Feature: It stays live
  The files on disk are the state and the page follows them. Nobody reloads and
  nobody presses refresh: the store probes, revalidates, and pushes the next
  snapshot down the subscription the first one arrived on. Every scenario here
  proves the page did NOT reload, because a page that reloaded would pass the
  same assertions while proving nothing.

  These edit the served directory underneath a running server, which is why
  they are `@scratch:` — a private copy of the `good` corpus, thrown away with
  the scenario. See `support/hooks.ts`.

  Background:
    Given I open the outline "garden.jsonl"
    And I mark the page

  Scenario: An edit on disk reaches the open page
    When I rewrite "garden.jsonl" as:
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
    # A file edited and a file that did not exist, written back to back — the
    # shape of a `git pull`. The settle delay is what makes them one probe, and
    # one probe is what makes them one published set: half a pull is a set that
    # was never on disk.
    When I rewrite "garden.jsonl" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true}
      {"id":"compost","parent":"garden","ord":"a1","title":"turn the compost","after":["mint"]}
      """
    And I rewrite "shed.jsonl" as:
      """
      {"id":"shed","ord":"a0","title":"clear out the shed"}
      {"id":"rake","parent":"shed","ord":"a0","title":"hang up the rake"}
      """
    Then the outline list has 3 entries
    And the node "compost" is shown
    And the page has not reloaded
    And there should be no page errors

  Scenario: One file that will not parse costs that one outline
    # The hybrid error scope: house.jsonl loses its tree and nothing else does.
    # Note what stays true — the sidebar still lists it, garden.jsonl is still
    # drawn, and there is no banner, because nothing is being held back.
    When I rewrite "house.jsonl" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}
      {"id":"order","parent":"kitchen","ord":"a1",title:"order the new cabinets"}
      """
    Then the outline "house.jsonl" is marked unreadable
    And no stale banner is shown
    And the node "herbs" is shown
    When I open the unreadable outline "house.jsonl"
    Then the outline failure shows an error at "house.jsonl:3"
    And the outline failure shows an error with code "not-json"
    And the page has not reloaded

  Scenario: A reference that dangles holds the last good tree under a banner
    # `nowhere` is nobody's id, and no single file owns that fact — so the whole
    # set is held, the tree on screen is the one from before, and the banner
    # says so. Fixing the file is the whole of the recovery.
    When I rewrite "garden.jsonl" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true,"after":["nowhere"]}
      """
    Then the stale banner is shown
    And the stale banner shows an error with code "unknown-target"
    And the node "mint" is shown
    When I rewrite "garden.jsonl" as:
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

  # ── membership, not just text ────────────────────────────────────────
  #
  # Every scenario above rewrites a file with the SAME records in the SAME
  # order, or appends at the end, and then asks whether some title reads the way
  # it should. That is the shape of edit a mis-merged snapshot survives — and
  # while these were green, the live view was in fact broken for the edits
  # people actually make: a line spliced into the middle of a file, a record
  # deleted from the middle, an editor rewriting a file in a different order.
  # Under a merge that guessed at element identity those lost records and drew
  # others twice, and no assertion here could see it, because a duplicate node
  # still has the right title.
  #
  # So these four ask for the whole id multiset: every node of the file drawn
  # exactly as many times as the file declares it. That is the property a bad
  # merge breaks, and the assertion is cheap to read when it fails (it names
  # what went missing and what was drawn twice, with the line each node claims).

  Scenario: A record spliced into the middle of a file appears, once
    When I rewrite "garden.jsonl" as:
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
    Then the outline "garden.jsonl" shows exactly the nodes "garden, herbs, basil, mint, beds, peas, beans, compost"
    # The insert is at line 5 — the middle of the file, not the end, which is
    # the whole distinction this scenario exists for.
    When I rewrite "garden.jsonl" as:
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
    Then the outline "garden.jsonl" shows exactly the nodes "garden, herbs, basil, mint, chives, beds, peas, beans, compost"
    And the node "chives" has the title "divide the chives"
    And the page has not reloaded

  Scenario: A record deleted from the middle goes, and takes nothing with it
    When I rewrite "garden.jsonl" as:
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
    Then the outline "garden.jsonl" shows exactly the nodes "garden, herbs, basil, mint, beds, peas, beans, compost"
    When I rewrite "garden.jsonl" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}
      {"id":"beds","parent":"garden","ord":"a1","title":"the raised beds"}
      {"id":"peas","parent":"beds","ord":"a0","title":"stake the peas"}
      {"id":"beans","parent":"beds","ord":"a1","title":"sow the beans"}
      {"id":"compost","parent":"garden","ord":"a2","title":"turn the compost"}
      """
    Then the outline "garden.jsonl" shows exactly the nodes "garden, herbs, basil, beds, peas, beans, compost"
    And the page has not reloaded

  Scenario: A file rewritten in a different order still says the same thing
    # An editor that rewrites a whole file — or a sort, or a merge — changes
    # nothing about the outline: `ord` decides what is drawn where, and the file
    # order is not the outline's order. So nothing on screen may move, and no
    # title may end up on somebody else's node.
    When I rewrite "garden.jsonl" as:
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
    Then the outline "garden.jsonl" shows exactly the nodes "garden, herbs, basil, mint, beds, peas, beans, compost"
    When I rewrite "garden.jsonl" as:
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
    Then the outline "garden.jsonl" shows exactly the nodes "garden, herbs, basil, mint, beds, peas, beans, compost"
    And the node "basil" has the title "sow the basil"
    And the node "mint" has the title "split the mint"
    And the node "peas" has the title "stake the peas"
    And the node "beans" has the title "sow the beans"
    And the page has not reloaded

  Scenario: A middle insert does not poison the edits after it
    # The one that says why this feels like "the live view is dead" rather than
    # "one edit was missed": a page whose tree was mis-merged once keeps merging
    # into the wrong tree, so every later edit is wrong too — including the
    # end-appends that work on a clean page. Both new ids have to arrive.
    When I rewrite "garden.jsonl" as:
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
    Then the outline "garden.jsonl" shows exactly the nodes "garden, herbs, basil, mint, beds, peas, beans, compost"
    When I rewrite "garden.jsonl" as:
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
    And I rewrite "garden.jsonl" as:
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
    Then the outline "garden.jsonl" shows exactly the nodes "garden, herbs, basil, mint, chives, beds, peas, beans, compost, leaves"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A zoomed node's own page is as live as its outline
    # `/n/<id>` draws from the same store as a whole outline, so "it stays
    # live" has to mean the same thing there. Zooming is a route change and not
    # a load, which is why the mark planted in the Background is still valid.
    When I zoom into the node "herbs"
    And I rewrite "garden.jsonl" as:
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
