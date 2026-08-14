Feature: Finding a note you cannot name

  Search matches the letters you type. That is evidence — the words are in the
  node — and it is the whole of what olai answered until now. It also means a
  note you remember the SENSE of but not the WORDS of is unreachable: nothing
  in "the slugs got the seedlings last year" contains "snails".

  Search by meaning fills that in, behind the exact matches and never in front
  of them, and a hit that arrived that way wears `≈` — because the reader is
  owed the difference between a match they can check and one the index is
  guessing at.

  It runs entirely on what olai ships: the embedder and its weights are in the
  binary's own nix closure, spawned as a child over a unix socket. Nothing is
  installed, nothing is fetched, nothing on the network is asked. That is the
  condition this feature came back on, so this drives the real one.

  @scratch:good @recall
  Scenario: A note the words cannot reach is found by what it means
    Given I open the outline "garden.jsonl"
    When I press the palette shortcut
    And I search the palette for "protecting young plants from snails" until a resembling node appears
    Then the palette lists the node "the slugs got the seedlings last year"
    # Marked as resemblance rather than as evidence: not one word of the query
    # is in that node, and the reader is owed that difference.
    And the palette row "the slugs got the seedlings last year" is about "≈ the cold frames"
    When I pick the palette item "the slugs got the seedlings last year"
    Then the address is "/n/slugs"

  @corpus:good
  Scenario: With recall off, search is exactly what it was
    # The degradation contract, from the outside: a server with no index
    # answers the substring reading and says nothing at all about a feature
    # being absent — the absence of a feature is not an error.
    Given I open the outline "garden.jsonl"
    When I press the palette shortcut
    And I type "protecting young plants from snails" into the palette
    Then the palette lists no node at all
    When I type "seedlings" into the palette
    Then the palette lists the node "the slugs got the seedlings last year"
    And the palette does not offer "≈"
