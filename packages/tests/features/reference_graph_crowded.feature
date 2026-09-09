@share-scratch
@scratch:good
Feature: The crowded reference graph — only the labels that fit say their names
  A page crowded past what its words can carry answers the way a reading
  answers: the dots stay, the words that collide leave, and pointing still
  names anything. The crowd here is one outline's many rows all pointing
  at the bed — enough that the fitted drawing cannot name them all.

  It stands beside the family's other feature rather than inside it because
  a scratch may serve ONE corpus; this one's crowd is seeded beside the
  fixture rows, which the narrower family feature does not want.

  Background:
    Given the outline "house.olai" holds a row whose see points at the herb bed

  Scenario: A crowded graph names only the labels that fit, and pointing names any dot
    # Thirty rows in one holding pattern, all pointing at the bed: the
    # drawing is honest, which here means quieter, not busier.
    Given the outline "house.olai" holds 30 more rows whose see point at the herb bed
    When I open the reference graph
    Then the graph draws every dot, naming only the ones that fit
    When I hover the graph dot "#ref-crowd-7"
    Then the graph's caption reads "watch the bed 7 — kitchen remodel #home — house.olai"
    And there should be no page errors
