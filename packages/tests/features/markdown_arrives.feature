Feature: The markdown pipeline arrives before it is needed
  Interpreting markdown takes a parser, a sanitiser and a syntax highlighter —
  ~391 KB of the client, and an outline of plain titles runs none of it: a
  tree is titles, checkboxes and badges, and a title with no markdown in it is
  words this app can write out itself.

  So the pipeline is a chunk of its own, and since 2026-08-24 the SHELL names
  it: a `<link rel="modulepreload">` written into `index.html` by the build,
  so the bytes travel beside the entry instead of a round trip after it. That
  is a reversal, and it was made for the thing this feature is really about —
  the moment before it lands. What runs it is still the dynamic `import()` a
  page makes when something on it turns out to need a parser, and nothing on
  the page ever waits for either: the rows draw, the document draws, and what
  they hold until the renderer is here is the file's own text.

  Which is the whole of the second half. That text is TRUTHFUL — it is the
  real characters, so the box is the size the words make — and it must never
  be READ: it is blurred and swept until the rendering replaces it, at every
  surface, by one rule over the state the app already named
  (`data-markdown="waiting"`). A frame of legible `**` was the bug
  (`markdown-raw-flash`), and "no such frame is ever painted" is a claim about
  frames a step cannot see afterwards — so the scenarios that make it have the
  document watch itself (`@markdown-paints`, `support/paints.ts`).

  @corpus:good
  Scenario: The shell fetches the pipeline, and the outline does not wait for it
    Given the markdown pipeline is held up
    When I open the outline "house.olai"
    # Not "nothing was drawn": the tags and the marks are on the page, drawn
    # from the bundle that was already there, while the parser is still in the
    # air.
    Then the title of "kitchen" styles the tag "home"
    And the node "demo" has the title "take out the old counters"
    And the shell asked for the markdown pipeline
    And there should be no page errors

  @corpus:good
  Scenario: A document fetches it, once, and renders
    When I open the document "finishes.md"
    Then the document renders bold text "matte"
    # ONE request for it on the whole page: the shell's preload is what the
    # `import()` then finds, rather than a second trip for the same bytes.
    And the markdown pipeline was fetched once
    # Same claim the highlighter has always made, now that it travels in its
    # own file: this server shipped it, and no CDN was asked.
    And the page requested nothing off this server
    And there should be no page errors

  @corpus:good
  Scenario: While it is on its way, the document is its own text — and illegible
    Given the markdown pipeline is held up
    When I open the document "finishes.md"
    Then the document shows its own markdown source
    And the document is waiting illegibly
    When the markdown pipeline arrives
    Then the document renders bold text "matte"
    And there should be no page errors

  # A renderer that never comes is a page that must still be readable, and must
  # say what happened. There ARE page errors in this one — the failed fetch is
  # reported in the console, deliberately — so the usual step is absent.
  #
  # The source is LEGIBLE here, and that is the rule working rather than an
  # exception to it: blurring is what a page does while an answer is coming,
  # and once none is coming the text somebody wrote is the answer.
  @corpus:good
  Scenario: If it never comes, the page says so and keeps the text
    Given the markdown pipeline never arrives
    When I open the document "finishes.md"
    Then the document says its renderer never came
    And the document shows its own markdown source
    And the document is not waiting

  # Titles are the case that decides whether an outline pays for markdown at
  # all: a plain one is drawn immediately, and one with marks in it shows what
  # was written — illegibly — until the pipeline can say better.
  @scratch:good
  Scenario: A title with markdown in it shows its source, then renders
    Given the markdown pipeline is held up
    Given I open the outline "house.olai"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"**take out** the old counters"}
      """
    Then the title of "demo" shows its markdown source
    And the title of "demo" is waiting illegibly
    And the title of "kitchen" styles the tag "home"
    When the markdown pipeline arrives
    Then the title of "demo" renders bold text "take out"
    And there should be no page errors

  # THE CLAIM THE FIX IS: not that the source is gone — it is deliberately
  # still there, because its box is the truthful one — but that no reader could
  # read it, at any surface, in any frame. The document watches itself for
  # every element that enters the waiting state and asks what it looked like at
  # that moment, which is a question only the page can answer: by the time a
  # step can look, the rendering has landed.
  @scratch:good @markdown-paints
  Scenario: No frame of legible raw markdown is ever painted
    Given the markdown pipeline is held up
    Given I open the outline "house.olai"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"**take out** the old counters","desc":"Doors: **matte**, not gloss."}
      """
    # A title in a tree row...
    Then the title of "demo" is waiting illegibly
    # ...the `¶` note under it...
    When I open the note of "demo"
    Then the description of "demo" is waiting illegibly
    # ...and a search row, which draws the same title through the same ladder.
    When I press the palette shortcut
    And I type "counters" into the palette
    Then the palette item for node "demo" is waiting illegibly
    # Every frame this page has painted so far, asked of the page itself. Asked
    # HERE as well as at the end because the record belongs to the DOCUMENT,
    # and the next step loads another one.
    And no frame of legible raw markdown was painted
    When I close the palette
    # ...and the document body, on its own page.
    And I open the document "finishes.md"
    Then the document is waiting illegibly
    When the markdown pipeline arrives
    Then the document renders bold text "matte"
    And no frame of legible raw markdown was painted
    And there should be no page errors

  # ...and the swap itself is a DE-BLUR. The same element throughout — nothing
  # remounts — so the block does not jump when the words arrive. Its HEIGHT can
  # change, and that is honest: a rendering of the text is not the same shape as
  # the text, and the alternative is inventing one.
  @scratch:good
  Scenario: The rendering replaces the source without moving the block
    Given the markdown pipeline is held up
    Given I open the outline "house.olai"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","desc":"Doors: **matte**, not gloss."}
      """
    When I open the note of "demo"
    Then the description of "demo" is waiting illegibly
    When I note where the description of "demo" sits
    And the markdown pipeline arrives
    Then the description of "demo" renders bold text "matte"
    And the description of "demo" is not waiting
    And the description of "demo" is where it was
    And there should be no page errors
