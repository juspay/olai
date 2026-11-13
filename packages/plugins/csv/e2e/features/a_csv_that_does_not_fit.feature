Feature: A `.csv` wider than the page it is drawn on
  Somebody's export is not four columns of four rows. It is the bank's
  statement, the report a script wrote, the sheet with a column per month —
  files that do not fit the lane they are drawn in, on any screen. olai draws
  those in a scroll container, which is the right answer and, left alone, half
  an answer: a box that only a pointer can move is a part of the page a person
  travelling by keyboard cannot read at all, and a box that announces nothing is
  a place a screen reader's user arrives in with no idea what they are standing
  in.

  So the promise this feature holds is the whole of it, read the way a person
  meets it:

    - the table is a NAMED REGION. The name is the file's own path, said once as
      the table's `<caption>` and borrowed by the region around it, so the table
      is named in a screen reader's table list and the region is named on the
      way in;
    - the header cells say they head COLUMNS (`scope`), which is the fact a
      `.csv` actually states — its first row is the header — and the only one.
      Nothing here claims a row header: a `.csv` says nothing about its first
      column, and a page that called it a row header would be inventing a fact
      about somebody's export;
    - a KEYBOARD reaches it, by pressing the key rather than by anything this
      suite calls, and the arrow keys move it in both directions once it is
      there;
    - the ring that says where focus went is still ON THE SCREEN. A focusable
      scroll container is exactly where a ring drawn outside the box gets
      clipped away by the pane around it — the indicator that is in the
      stylesheet and nowhere a person can see. It is read as geometry: the
      ring's own rectangle, inside every ancestor that clips;
    - the header stays against the top while the rows move under it.

  The file is written by the scenario (`@scratch:good`) and not checked in: what
  is being tested is a SHAPE — more columns than fit and more rows than fit —
  and a thousand lines of nothing is the one thing the corpus is meant not to
  hold. Both counts stay under the format's bounds, so the clamp sentence stays
  out of the way; the clamp has its own scenario next door.

  @scratch:good
  Scenario: A keyboard reaches the wide table, names it, and moves it
    Given a csv of 60 data rows and 24 columns exists at "data/wide.csv"
    When I open the address "/data/wide.csv"
    Then the document open is "data/wide.csv"
    # What it IS, before anything about moving it: a region, named for the file
    # it is showing, with a header row that says what it heads.
    And the table's scroller is a region named "data/wide.csv"
    And every header cell heads its column
    # ...and it is REACHABLE. Tab presses, not a call to `focus()`: nothing in a
    # table of text takes focus on its own, and the defect this guards against
    # is a page where no number of presses would arrive.
    When I travel by keyboard to the table's scroller
    Then the focus ring on the table's scroller is not clipped away
    When the arrow keys move the table
    Then the table has moved sideways and down under them
    # The point of a sticky header, read as geometry: the rows moved and the
    # names of the columns did not go with them.
    And the header row is still against the top of the scroller
    And there should be no page errors
