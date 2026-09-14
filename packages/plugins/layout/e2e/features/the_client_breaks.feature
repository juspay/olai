@corpus:good
Feature: When olai itself breaks
  Three of this app's error surfaces are about the FILES — the whole-page
  report, the banner over a last-good tree, one outline's own pane — and all
  three are errors read off the wire and drawn on purpose. None of them can say
  anything about a bug in the client, because a client that has thrown
  mid-render is not running the code that would draw them.

  What a reader got instead was a white tab, with the truth in a console they
  had no reason to open. That is exactly how PR #70's `RangeError` arrived, and
  the person who hit it could say nothing about it but "it went blank". So the
  shell is wrapped in kolu's `SurfaceFaultBoundary` — the framework catches,
  records and prints; olai owns only the LOOK — and this is what it draws.

  There is no way to ASK this app to break, and there should not be: a fault
  switch is a fault switch, on in production too. So the fault is injected from
  outside, when the layout draws its header DOM. The injection leaves scoped
  provider startup intact and throws the original error inside the rendering
  boundary. What it stands in for is any bug at all in a render.

  Scenario: A fault while drawing is a card, not a white tab
    Given this client's own code throws while it draws
    When I open a page it cannot draw
    Then the page says it broke
    And the fault is on the page, verbatim
    # Two: a reload for a bundle that is stale, and the way OFF this page for a
    # fault that is deterministic for the route — which is the usual kind, and
    # against which a reload on its own is a loop.
    And both ways out are offered
