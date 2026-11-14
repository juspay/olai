@corpus:good
Feature: The picture a page IS
  A picture in the served directory has a page of its own, and that page is the
  picture: one `<img>`, pointed at the file on the media route, with nothing
  above it but the path it lives at.

  That makes it the one surface in olai where the largest contentful paint is
  not a guess, and the priority it is drawn with says so — the opposite answer
  from the pictures inside a document, which wait for the reader
  (`packages/plugins/markdown/e2e/features/documents.feature`). The two
  together are the whole of the rule: a picture waits only when something on
  the same page is more worth having first, and here there is nothing else on
  the page at all.

  Scenario: The picture a page is made of is fetched at once, ahead of everything
    When I open the address "/art/handle.png"
    Then the document open is "art/handle.png"
    And the picture drawn is "art/handle.png"
    # Not deferred, and asked for ahead of the rest of the page's fetches.
    And the picture that is the page is fetched first
    # …and it really arrived, which is what makes the priority worth anything.
    And the picture has loaded
    And there should be no page errors
