@corpus:good
Feature: Filtering the outline in place
  Workflowy's move, and the one the tags have been waiting for: a query does not
  open a list of results somewhere else — it takes rows AWAY from the outline in
  front of you, keeping every match and the ancestors that lead to it, so the
  thing you found is still standing where it lives.

  What decides which nodes match is `@olai/format`'s one matcher, which also
  gates an agent's `search_nodes` and the ⌘K palette (`filter.test.ts` holds the
  grammar). These scenarios are about the other half: what the page does with
  the answer, where the filter lives (the address), and what it says when it
  finds nothing.

  Scenario: A match is drawn with the ancestors that lead to it
    # The whole promise. `hinges` lives under `install`, which lives under
    # `kitchen`: all three stay, everything else goes, and the count says how
    # many of the rows on screen are actually matches.
    Given I open the outline "house.olai"
    Then the outline has 10 rows
    When I filter the page by "hinges"
    Then the outline has 3 rows
    And the node "kitchen" is shown
    And the node "install" is shown
    And the node "hinges" is shown
    And the node "handles" is not shown
    And the filter found "1 of 10"
    # Which of the three the query actually SELECTED, as a fact on the row —
    # the other two are the context that makes a bare title mean something.
    And the node "hinges" is a match
    And the node "kitchen" is context

  Scenario: A filtered page says WHY each row is drawn
    # The whole of the 2026-08-18 ruling, on one page: every row here was
    # already CORRECT before it and the page was still confusing, because
    # nothing said why any given row was in front of the reader. Three cases,
    # and this one query draws all three at once.
    #
    # `alcove` is a word in `order`'s NOTE and nowhere in its title; `hinges`
    # is a word in the title of `hinges`. `kitchen` and `install` carry
    # neither and are here only as the ancestry that leads to the two matches.
    Given I open the outline "house.olai"
    When I filter the page by "alcove OR hinges"
    Then the outline has 4 rows
    And the filter found "2 of 10"
    # 1. THE MATCH SHOWS ITS NEEDLE — where in the title the query landed,
    #    which is the reader's own answer to use-versus-mention.
    And the node "hinges" is a match
    And the node "hinges" lights "hinges"
    # 2. A KEPT ANCESTOR IS NOT A MATCH, and now says so in ink as well as in
    #    `data-match`: nothing of the query is in either title, so nothing
    #    lights up in them.
    And the node "kitchen" is context
    And the node "kitchen" lights nothing
    And the node "install" is context
    And the node "install" lights nothing
    # 3. A NOTE-ONLY MATCH DRAWS ITS REASON — one clamped line of the note
    #    around the hit, because the title holds nothing the reader typed.
    And the node "order" is a match
    And the node "order" lights nothing
    And the node "order" excerpts "alcove"

  Scenario: A row found by its title needs no second line saying so
    # The excerpt is drawn for the row whose title says NOTHING of the query,
    # and only that row — a note repeating what the title already lit would be
    # noise on a page whose whole problem was too little signal. `order` is
    # the one node here carrying a note, and `cabinets` is in its title.
    Given I open the outline "house.olai"
    When I filter the page by "cabinets"
    Then the node "order" is a match
    And the node "order" lights "cabinets"
    And the node "order" draws no excerpt

  Scenario: A query with no words in it lights nothing on the rows it finds
    # `is:done` selects on a MARK, and a mark is not text in a title — so
    # there is nothing to light, and lighting something would be the row
    # inventing a reason it was not found for.
    Given I open the outline "house.olai"
    When I filter the page by "is:done"
    Then the node "demo" is a match
    And the node "demo" lights nothing

  Scenario: The filter is part of the address, so it survives a reload
    # A narrowed page is a link somebody can send. That is the same argument
    # `/#<id>` is made of, and it is why the filter is in the URL rather than
    # in a signal beside it.
    Given I open the outline "house.olai"
    When I filter the page by "hinges"
    Then the address is exactly "/house.olai?q=hinges"
    When I reload the page
    Then the outline has 3 rows
    And the filter box holds "hinges"

  Scenario: Clearing the filter takes the query out of the address entirely
    # An unfiltered page has ONE spelling — no `?q=`, no empty query — so one
    # page is one string in the bar.
    Given I open the outline "house.olai"
    When I filter the page by "hinges"
    And I clear the filter
    Then the address is exactly "/house.olai"
    And the outline has 10 rows

  Scenario: A collapsed ancestor does not hide a match
    # Folds are SUSPENDED while a filter is on. A fold is a claim about the
    # tree the reader was reading; the filter makes a different tree, and
    # honouring the collapse inside it would hide the very match that was typed
    # for. Nothing is written — clearing the filter brings the fold back.
    Given I open the outline "house.olai"
    When I collapse the node "install"
    Then the node "hinges" is not shown
    When I filter the page by "hinges"
    Then the node "hinges" is shown
    When I clear the filter
    Then the node "hinges" is not shown

  Scenario: `is:done` reads the mark a node stores
    # Never a derived one: `kitchen` has a finished child and carries `doing`
    # itself, so it is here as the ancestry rather than as a match. The second
    # match is `basil`, drawn under the MIRROR of `herbs` this outline holds —
    # a placement matches by the node it shows, wherever it is drawn.
    Given I open the outline "house.olai"
    When I filter the page by "is:done"
    Then the node "demo" is a match
    And the node "kitchen" is context
    And the filter found "2 of 10"

  Scenario: The count line is measured against what the page holds, not what a preference left
    # THE DENOMINATOR, on the page where NOTHING is being held back — which is
    # the case the scenario below cannot show. `hinges` matches one open row
    # and neither finished one, so the line is the count and NOTHING ELSE: the
    # page draws eight rows, the line says ten, and ten is what the page HOLDS.
    # It used to be the rows that were left, which is where the arithmetic
    # broke the moment a match was held back as well.
    #
    # The reading is EXACT here, and that is half of what this scenario is for:
    # asked as a substring it would go green against a bar that had appended a
    # clause about matches nothing is holding back (review of #248, both
    # reviewers). One element, one sentence, one comparison.
    Given I open the outline "house.olai"
    Then the outline has 10 rows
    When I hide the done nodes
    # `demo` and `basil` are finished, and the tree is two rows shorter for it.
    Then the outline has 8 rows
    When I filter the page by "hinges"
    Then the filter found "1 of 10"

  Scenario: Matches held back by the done preference are counted, and the reason is named
    # The sentence this whole line exists for: a query that found three things
    # on a page drawing one of them says so, says why the other two are not
    # there, and says where the switch is. `hinges` is open work; `demo` and
    # `basil` are the finished ones, and `basil` is a match under the MIRROR of
    # the herb bed, which is a row of this page like any other.
    Given I open the outline "house.olai"
    When I hide the done nodes
    And I filter the page by "hinges OR is:done"
    Then the node "hinges" is a match
    And the node "demo" is not shown
    And the filter found "1 of 10 — 2 more matches hidden as done (Prefs)"
    # ...and with nothing drawn at all, the same three truths minus the word
    # `more`, which would be more than the nothing on screen. This is `is:done`
    # typed by somebody who hides finished work — the page that must never look
    # like an empty directory.
    When I filter the page by "is:done"
    Then the outline has 0 rows
    And the filter found "no matches of 10 — 2 matches hidden as done (Prefs)"

  Scenario: `has:desc` finds the node carrying a note
    Given I open the outline "house.olai"
    When I filter the page by "has:desc"
    Then the node "order" is a match
    And the filter found "1 of 10"

  Scenario: `date:` takes a day, and a range of them
    # The two dates a journal reads: `order` is scheduled for the 10th, `demo`
    # was finished on the 3rd. A dated `todo` is on no day, here as on the day
    # page, which is why `hinges` never turns up.
    Given I open the outline "house.olai"
    When I filter the page by "date:2026-08-10"
    Then the node "order" is a match
    And the filter found "1 of 10"
    When I filter the page by "date:2026-08-01..2026-08-31"
    Then the node "order" is a match
    And the node "demo" is a match
    And the node "hinges" is not shown
    And the filter found "2 of 10"

  Scenario: `date:` takes the words for a day as well as the day
    # Counted from the day the page is being READ on, out of the tab's own
    # clock — so what these select moves, and only the shapes that stay true
    # are asserted: every date in this fixture is in the past, and stays there.
    # The grammar's own boundaries are pinned where they can be
    # (`format/filter.test.ts`, against a fixed day).
    Given I open the outline "house.olai"
    When I filter the page by "date:..today"
    Then the node "order" is a match
    And the node "demo" is a match
    # Three, not two: the herb bed is mirrored into this outline, and the row
    # showing `basil` (sown in July) is a match wherever it is drawn — the same
    # rule every other filter here follows.
    And the filter found "3 of 10"
    # A relative word at the other end of a range, and nothing here is
    # scheduled beyond today.
    When I filter the page by "date:tomorrow.."
    Then the filter found "no matches of 10"

  Scenario: A word the relative vocabulary does not hold is refused
    # The same contract every unknown value is held to: `date:tomorrowish` is
    # not searched for as text and answered with an empty page — the reader is
    # told which words the operator takes.
    Given I open the outline "house.olai"
    When I filter the page by "date:tomorrowish"
    Then the filter refuses "date:tomorrowish" and says "today, yesterday, tomorrow"
    And the outline has 0 rows

  Scenario: A quoted phrase is one substring where two words are two
    # `pick the hinges` and `pick the knobs` are both on this page, and the
    # quotes are what put the ORDER of the words into the query. Unquoted, the
    # same two words are two independent substrings that may sit anywhere in
    # the node — which is what the second half of this scenario says.
    Given I open the outline "house.olai"
    When I filter the page by '"pick the hinges"'
    Then the node "hinges" is a match
    And the node "knobs" is not shown
    And the filter found "1 of 10"
    When I filter the page by '"hinges the pick"'
    Then the filter found "no matches of 10"
    When I filter the page by "hinges the pick"
    Then the node "hinges" is a match
    And the filter found "1 of 10"

  Scenario: `OR` is either one, and it binds tighter than the space
    # The precedence ruling, on the page it was made for. `cabinets` is in two
    # titles on this outline and `handles` in a third: `install cabinets OR
    # handles` is `install` AND one of the other two, which is the node that
    # says `install the cabinets` and nothing else. Read the other way round —
    # `(install AND cabinets) OR handles` — the answer would also hold
    # `handles`, a row with no `install` about it, which is a query that
    # quietly widened.
    Given I open the outline "house.olai"
    When I filter the page by "handles OR knobs"
    Then the node "handles" is a match
    And the node "knobs" is a match
    And the node "install" is context
    And the filter found "2 of 10"
    When I filter the page by "install cabinets OR handles"
    Then the node "install" is a match
    # Drawn, because a matching row keeps its whole subtree — and drawn as
    # CONTEXT, which is the distinction that says what the query selected. The
    # loose reading of the precedence would have made it a MATCH, on a row with
    # no `install` about it.
    And the node "handles" is context
    And the filter found "1 of 10"

  Scenario: `or` is a word and `OR` is the joiner
    # The one token in the grammar that is not case-folded, and the reason:
    # `or` is a word people write. This outline's note says "walnut ... birch",
    # and the query that finds it is the lower-case one.
    Given I open the outline "house.olai"
    When I filter the page by "walnut OR knobs"
    Then the node "order" is a match
    And the node "knobs" is a match
    And the filter found "2 of 10"
    When I filter the page by "walnut or knobs"
    Then the filter found "no matches of 10"

  Scenario: The three ways this grammar can be typed wrong are all refused
    # The refusal contract, extended to being typed wrong rather than asked
    # wrong. Nothing is closed or dropped on the reader's behalf: `"pick the`
    # and `"pick the"` are two different queries, and picking one is the quiet
    # answer to a question nobody asked.
    Given I open the outline "house.olai"
    When I filter the page by '"pick the'
    Then the filter refuses '"pick the' and says "a phrase runs from one"
    And the outline has 0 rows
    When I filter the page by "hinges OR"
    Then the filter refuses "OR" and says "one of them is missing"
    And the outline has 0 rows
    # The loud twin of the silent empty answer: an empty needle is inside every
    # node ever written, so this is the query that would draw the whole page
    # back. A phrase of nothing but spaces is the same query and says so too.
    When I filter the page by '""'
    Then the filter refuses '""' and says "no words in it"
    And the outline has 0 rows
    When I filter the page by '" "'
    Then the filter refuses '" "' and says "no words in it"
    And the outline has 0 rows

  Scenario: A group takes the derived operator and the field test together
    # `OR` joins TOKENS, so a clause is an alternative like anything else —
    # including the one derived value in the grammar. `hinges` is waiting on
    # `order`; `order` is the node carrying a note. Neither query is the other,
    # and this is the one page that draws both answers at once.
    Given I open the outline "house.olai"
    When I filter the page by "is:blocked OR has:desc"
    Then the node "hinges" is a match
    And the node "order" is a match
    And the node "install" is context
    And the filter found "2 of 10"

  Scenario: The header's box reads the same phrase, and refuses in the same words
    # One grammar, four doors — and this is the half that has to TRAVEL: the
    # filter parses in the browser, the header box asks the server, and a
    # phrase that meant one thing in each would be the drift the shared matcher
    # exists to refuse. The refusal rides back the same way `is:open`'s does.
    Given I open the outline "house.olai"
    When I search the header for '"pick the hinges"'
    Then the header search lists the node "pick the hinges"

  Scenario: A dangling `OR` is refused at the door that has to ask the server
    # The other half of the same seam. The box types one query per scenario —
    # it appends rather than replaces — so this is its own, and it is worth its
    # own: a door that answered `hinges OR` with an empty list and no reason
    # would be the one place a half-typed query looks like an empty directory.
    Given I open the outline "house.olai"
    When I search the header for "hinges OR"
    Then the search refuses "OR" and says "one of them is missing"

  Scenario: `-` takes a term or an operator back out
    Given I open the outline "house.olai"
    When I filter the page by "cabinets -is:doing"
    Then the node "install" is a match
    And the node "order" is not shown
    And the filter found "1 of 10"

  Scenario: `is:blocked` narrows the page to what is waiting on something
    # The one DERIVED value in the grammar, and the reason it is worth having:
    # `hinges` waits on `order`, which is still `doing`, so this page already
    # dims it and writes its `blocked by` line — and the filter is that same
    # reading rather than a second one written to the same paragraph.
    # `install` carries an `after` of its own and is here only as the ancestry:
    # it is a plain bullet, and a bullet is not being told it cannot start.
    Given I open the outline "house.olai"
    When I filter the page by "is:blocked"
    Then the node "hinges" is a match
    And the node "install" is context
    And the node "order" is not shown
    And the filter found "1 of 10"
    # ...and negated, it is everything that can be got on with — `hinges` is
    # still drawn, because a matching row keeps its whole subtree, and it is
    # drawn as CONTEXT, which is the distinction this page is made of.
    When I filter the page by "-is:blocked"
    Then the node "order" is a match
    And the node "install" is a match
    And the node "hinges" is context

  Scenario: A known operator with an unknown value is refused, not guessed at
    # The silent-error rule, in the one place a query language invites one: a
    # filter that quietly searched for the TEXT `is:open` would answer with
    # an empty page and no reason. The reader is told which values the operator
    # takes instead.
    Given I open the outline "house.olai"
    When I filter the page by "is:open"
    Then the filter refuses "is:open" and says "done, doing, todo, marked, blocked, mirrored, trashed"
    And the outline has 0 rows

  Scenario: A date no calendar could hold is refused too
    # `2026-13` is shape-clean and impossible, and it SORTS between December and
    # January — so swallowing it reads as a window rather than as nonsense. It
    # is the reader's mistake exactly as much as `date:soon` is.
    Given I open the outline "house.olai"
    When I filter the page by "date:2026-13"
    Then the filter refuses "date:2026-13" and says "2026-08-10"
    And the outline has 0 rows

  Scenario: The refusal quotes the reader, not the folded token
    # The words are matched case-folded; the refusal is quoted as TYPED. Telling
    # somebody who wrote `is:OPEN` that they wrote `is:open` is the
    # refusal misquoting the reader — the same defect class the refusal exists
    # to prevent, and the one none of the four doors had a scenario for.
    Given I open the outline "house.olai"
    When I filter the page by "is:OPEN"
    Then the filter refuses "is:OPEN" and says "done, doing, todo, marked, blocked, mirrored, trashed"
    # ...while a query that MATCHES still folds, so the two cannot be confused.
    When I filter the page by "IS:DONE"
    Then the node "demo" is a match

  Scenario: The header's box refuses the same operator, in the same words
    # One grammar, four doors. The filter parses for itself; the header box,
    # the ⌘K palette and an agent ask the server — and a door that answered
    # `is:open` with an empty list and no reason would be the one place a
    # typo looks exactly like an empty directory.
    Given I open the outline "house.olai"
    When I search the header for "is:open"
    Then the search refuses "is:open" and says "done, doing, todo, marked, blocked, mirrored, trashed"

  Scenario: The ⌘K palette refuses it too, in its own row
    # The third door. It reads the same `createNodeSearch` primitive the header
    # does, and draws the refusal in a row of its own — separate from the row
    # that says the CALL failed, because a refused call and a refused query are
    # two different pieces of news.
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "is:open" into the palette
    Then the search refuses "is:open" and says "done, doing, todo, marked, blocked, mirrored, trashed"

  Scenario: The ⌘K palette takes a phrase, over the same wire
    # And the same door on the day it ANSWERS. The palette is the one that
    # reads a query for two other things first — a leading `>` is an ask and a
    # `+` is a capture, neither of which is a lookup — so a grammar that grew a
    # new punctuation mark is worth asking it about: the quotes are a search,
    # and the row that comes back is the server's.
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type '"pick the hinges"' into the palette
    Then the palette lists the node "pick the hinges"

  Scenario: Pressing a `#tag` filters the page by it
    # The gesture the tags have been decorative for since title-markdown. It is
    # the same act as typing, so it lands in the same place: the address.
    Given I open the outline "garden.olai"
    When I press the tag "#outdoors"
    Then the address is exactly "/garden.olai?q=%23outdoors"
    And the filter box holds "#outdoors"
    And the node "garden" is a match

  Scenario: A pressed tag lights up on the rows that carry it
    # The gesture the whole ruling came from. The format cannot tell a tag USED
    # from a tag MENTIONED — a `#word` in a title IS a tag, deliberately — so
    # the pill is lit where it sits and the reader resolves the ambiguity
    # themselves, which is what a page of identical-looking rows could not let
    # them do.
    Given I open the outline "garden.olai"
    When I press the tag "#outdoors"
    Then the node "garden" is a match
    And the node "garden" lights "#outdoors"

  Scenario: Pressing a tag does not also put a caret in the row
    # One press, one act. A tag pill sits inside the title, whose own click
    # opens the editor — and Solid runs the row's handler before the pane's, so
    # without a guard the press would filter the page AND start an edit.
    Given I open the outline "garden.olai"
    When I press the tag "#outdoors"
    Then no row is being edited

  Scenario: Zooming leaves the filter behind, and Back brings it home
    # A zoom is a navigation: it asks for that node's page, not for that node's
    # page still narrowed by what was typed on the last one. The filtered
    # address is not lost — it is where Back goes.
    Given I open the outline "house.olai"
    When I filter the page by "cabinets"
    And I zoom into the node "install"
    Then the address is exactly "/#install"
    And the filter box holds ""
    When I go back
    Then the address is exactly "/house.olai?q=cabinets"

  Scenario: A zoomed page filters its own children
    # Scoped downstream, and it falls out of the address rather than being
    # implemented: the page decides its rows, the filter prunes them.
    Given I open the node "install"
    Then the outline has 3 rows
    When I filter the page by "is:todo"
    Then the outline has 2 rows
    And the node "handles" is not shown
    And the filter found "2 of 3"

  Scenario: There is no filter on the one page that cannot carry one
    # A document is PROSE, and this grammar selects nodes — so a document is the
    # one page with no `?q=` on its address, and drawing a box there would promise
    # something neither the URL nor the matcher has anywhere to put. Every other
    # page draws one (`filter_everywhere.feature`).
    Given I open the document "finishes.md"
    Then there is no filter bar

  Scenario: A tag is pressable exactly where the page can keep a filter
    # The pane says whether a tag in it is live, the stylesheet draws the cursor
    # on that fact, and the listener declines on the same condition — so a pill
    # never looks pressable and then swallows the press. That claim used to have
    # a second half about the pages with no filter to fill; the pages have one
    # now, and where the press lands on each of them is
    # `filter_everywhere.feature`.
    Given I open the outline "house.olai"
    Then tags on this page are pressable
    When I open the day "2026-08-10"
    Then tags on this page are pressable
