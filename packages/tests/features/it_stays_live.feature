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
    # The rewrite-and-watch scenarios count `basil` and `glazing` — finished
    # — among the rows the page must go on drawing; the pick is said once.
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
    # A file edited and a file that did not exist, written back to back — the
    # shape of a `git pull`. The settle delay is what makes them one probe, and
    # one probe is what makes them one published set: half a pull is a set that
    # was never on disk.
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
    # Folders start collapsed, so Daily/ is shut and the three root outlines
    # (garden, house, and the new shed) are what the list shows.
    Then the outline list has 3 entries
    And the node "compost" is shown
    And the page has not reloaded
    And there should be no page errors

  Scenario: One file that will not parse costs that one outline
    # The error scope: house.olai loses its tree and nothing else does. Note
    # what stays true — the sidebar still lists it, garden.olai is still drawn,
    # and the summary over both names exactly one file.
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
    # `nowhere` is nobody's id. That used to hold the WHOLE set — every page in
    # the app frozen at the last good revision behind a banner — and since the
    # human's ruling of 2026-08-29 it costs exactly the file that says it:
    # garden.olai draws its rows where its tree was, house.olai is live, and the
    # banner over both is a signpost naming the one broken file rather than a
    # warning about the page you are reading.
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true,"after":["nowhere"]}
      """
    Then the stale banner is shown
    And the stale banner names "garden.olai" as "invalid"
    # …and says it in ONE line. The banner is over every page in the app, so
    # what it may draw is a count and never the rows (`last-good-banner-flood`,
    # sighted with 135 of them above every open document).
    And the stale banner enumerates nothing
    # …and the line is a DOOR: every broken file has a page of its own now, so
    # the banner sends the reader to it rather than naming a destination with
    # nothing to show.
    And the stale banner links to "garden.olai"
    And the stale banner names 1 file
    And the outline "garden.olai" is marked unreadable
    # THE BROKEN FILE'S OWN PAGE: its rows, where its tree was.
    When I open the unreadable outline "garden.olai"
    Then the outline failure shows an error with code "unknown-target"
    And the outline failure shows an error at "garden.olai:4"
    # …AND THE NEIGHBOUR IS LIVE, drawn exactly as it always was. This is the
    # half that used to be impossible: every page in the app was the last good
    # copy behind that banner.
    When I click the outline "house.olai"
    Then the node "demo" is shown
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
    # The store's OTHER kind of error, and the one that used to have nowhere to
    # go. A file it cannot parse has always reached a reader; a TREE it cannot
    # read at all — EACCES, a mount that vanished, no room to answer a stat —
    # was written to the log and dropped, so the outline froze at the last good
    # revision and every page went on looking live. Same channel now, same
    # banner, over the same last-good tree.
    When the served directory is taken away
    # `eventually`, on the backstop's budget rather than the interaction one.
    # An edit INSIDE the directory is seen by the watcher and lands in
    # milliseconds; the root going away is the one change no watcher reports on
    # both platforms — macOS delivers nothing for it — so what notices is the
    # unconditional sweep. Same product on each, and only this scenario waits.
    Then the stale banner eventually appears
    And the stale banner names "." as "unreadable"
    # ...and it says the RIGHT thing. The banner's lede was written when the
    # only way to be stale was a set that would not validate, so it told
    # everybody to go and fix their files — which for a mount that went away
    # is a lie of exactly the kind this whole item is about.
    And the stale banner says "The served directory cannot be read right now"
    And the node "herbs" is shown
    And the page has not reloaded
    # The RECOVERY half is deliberately not here, and it is a cost decision
    # rather than an oversight. A directory that comes back cannot be seen by
    # the watcher either — the old watch is on an inode that is gone — so it
    # too waits for a sweep, and asserting it here would spend a second
    # backstop of wall clock on every CI run of both platforms. It is unit
    # tested where it is free and exact: `@olai/store`'s "a directory that
    # comes back clears what was said about it".

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
    # The insert is at line 5 — the middle of the file, not the end, which is
    # the whole distinction this scenario exists for.
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
    # An editor that rewrites a whole file — or a sort, or a merge — changes
    # nothing about the outline: `ord` decides what is drawn where, and the file
    # order is not the outline's order. So nothing on screen may move, and no
    # title may end up on somebody else's node.
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
    # The one that says why this feels like "the live view is dead" rather than
    # "one edit was missed": a page whose tree was mis-merged once keeps merging
    # into the wrong tree, so every later edit is wrong too — including the
    # end-appends that work on a clean page. Both new ids have to arrive.
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
    # The shape the residual report came in on: new `.olai` files appearing
    # under a live tab while ANOTHER outline is being read — a port, a clone, a
    # sync finishing. Every scenario above edits the file on screen; this one
    # never touches it, which makes the promise absolute. Nothing about
    # garden.olai changed, so nothing drawn from it may change either — and
    # that is a claim only the whole multiset can make, since a tree that drew
    # one node twice still reads correctly.
    When I rewrite "shed.olai" as:
      """
      {"id":"shed","ord":"a0","title":"clear out the shed"}
      {"id":"rake","parent":"shed","ord":"a0","title":"hang up the rake"}
      """
    # Root outlines only: Daily/ stays collapsed. garden + house + shed.
    Then the outline list has 3 entries
    And the outline "garden.olai" shows exactly the nodes "garden, herbs, basil, mint, frames, glazing, sowing, slugs, compost, turned, straw"
    And the node "basil" has the title "sow the basil"
    And the page has not reloaded
    And there should be no page errors

  Scenario: An outline whose name carries a quote arrives like any other
    # A vault is somebody's folder and a `"` is a legal character in a file
    # name on every platform olai serves from, so this is an ordinary file —
    # and it is the one shape this suite could not GRIP. Every step that finds
    # a row by what it carries builds a `[data-…="…"]`, and a value with a
    # quote in it used to end that string early: Playwright would refuse the
    # selector and the step would die naming a parse error rather than the row.
    # Nothing in the app was ever at risk — Solid writes dynamic attributes
    # through `setAttribute`, so the DOM is escaped by construction.
    #
    # So this scenario is where a real browser agrees with
    # `support/selectors.ts`' rule: `selectors.test.ts` holds the grammar, and
    # the two assertions below are Chromium parsing what that rule builds and
    # matching it against the attribute the client really wrote. Delete the
    # escaping and this goes red on the selector, not on a timeout.
    When I rewrite "say \"hi\".olai" as:
      """
      {"id":"quoted","ord":"a0","title":"an outline nobody could grip"}
      """
    # Root outlines only, Daily/ still collapsed: garden + house + this one.
    Then the outline list has 3 entries
    And the outline list links to "say \"hi\".olai"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A FILTERED page follows the files too, in both directions
    # The claim `search-server-side` has to keep and nearly did not: a filter is
    # a STANDING VIEW of the page, not a shortlist somebody opened once. It used
    # to be a memo over the local set, so every published revision re-ran the
    # matcher for free; it is a question to the server now, and a question keyed
    # on the words alone would have made a filtered page a photograph of the
    # directory as it was when the query settled — the rows redrawing underneath
    # while the answer that prunes them stood still.
    #
    # It earns the browser twice over: only a real wire re-asks, and the failure
    # is invisible to every unit suite — the two numbers even keep adding up
    # ("1 of 11" over a page holding two matches), because the denominator is
    # counted locally and the numerator came from the server a revision ago.
    #
    # `trays` is a word no id in this file carries, which is the care a query
    # over this matcher needs: an id is one of the four fields it looks in, so a
    # row "retitled out of" a query that happens to be its own id is still a
    # match, correctly.
    When I filter the page by "trays"
    Then the filter found "1 of 11"
    # Two rows retitled INTO the query have to arrive as matches.
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
    # ...and rows retitled OUT of it have to leave, which is the half a stale
    # answer keeps drawn, still lit, still counted.
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door","doing":"2026-07-20"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true}
      """
    Then the filter found "no matches of 4"
    And the node "basil" is not shown
    And the page has not reloaded
    And there should be no page errors

  Scenario: A zoomed node's own page is as live as its outline
    # `/#<id>` draws from the same store as a whole outline, so "it stays
    # live" has to mean the same thing there. Zooming is a route change and not
    # a load, which is why the mark planted in the Background is still valid.
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
