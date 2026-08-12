Feature: The markdown pipeline arrives when it is needed
  Interpreting markdown takes a parser, a sanitiser and a syntax highlighter —
  ~390 KB of the client, and an outline draws none of it: a tree is titles,
  checkboxes and badges, and a title with no markdown in it is words this app
  can write out itself.

  So the pipeline is a chunk of its own, fetched the first time something on
  the page has markdown to interpret. What is proved here is both halves of
  that: a page of rows never asks for it, and a page that does still shows the
  reader the file's own text while it is on its way — and says so if it never
  comes.

  @corpus:good
  Scenario: An outline paints without fetching the markdown pipeline
    When I open the outline "house.jsonl"
    Then nothing has asked for the markdown pipeline
    # Not "nothing was drawn": the tags and the marks are on the page, drawn
    # from the bundle that was already there.
    And the title of "kitchen" styles the tag "home"
    And the node "demo" has the title "take out the old counters"
    And there should be no page errors

  @corpus:good
  Scenario: A document fetches it, once, and renders
    When I open the document "finishes.md"
    Then the document renders bold text "matte"
    And the markdown pipeline was fetched once
    # Same claim the highlighter has always made, now that it travels in its
    # own file: this server shipped it, and no CDN was asked.
    And the page requested nothing off this server
    And there should be no page errors

  @corpus:good
  Scenario: While it is on its way, the document is its own text
    Given the markdown pipeline is held up
    When I open the document "finishes.md"
    Then the document shows its own markdown source
    When the markdown pipeline arrives
    Then the document renders bold text "matte"
    And there should be no page errors

  # A renderer that never comes is a page that must still be readable, and must
  # say what happened. There ARE page errors in this one — the failed fetch is
  # reported in the console, deliberately — so the usual step is absent.
  @corpus:good
  Scenario: If it never comes, the page says so and keeps the text
    Given the markdown pipeline never arrives
    When I open the document "finishes.md"
    Then the document says its renderer never came
    And the document shows its own markdown source

  # Titles are the case that decides whether an outline pays for markdown at
  # all: a plain one is drawn immediately, and one with marks in it shows what
  # was written until the pipeline can say better.
  @scratch:good
  Scenario: A title with markdown in it shows its source, then renders
    Given the markdown pipeline is held up
    Given I open the outline "house.jsonl"
    When I rewrite "house.jsonl" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"**take out** the old counters"}
      """
    Then the title of "demo" shows its markdown source
    And the title of "kitchen" styles the tag "home"
    When the markdown pipeline arrives
    Then the title of "demo" renders bold text "take out"
    And there should be no page errors
