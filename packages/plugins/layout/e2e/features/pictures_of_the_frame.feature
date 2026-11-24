@corpus:good
Feature: Pictures of the frame, for a person to judge
  Evidence and not an assertion: whether one bar, a split without boxes, a
  sidebar that reads in one order and pages on one edge LOOK right together is
  a person's call. Each picture is of the fixture directory, saved beside the
  run's other screenshots; a run that keeps no screenshots saves nothing and
  still runs every step.

  Scenario: A picture of the frame on a desktop, with a split
    Given I open the outline "house.olai"
    When I expand the folder "notes"
    And I save a screenshot as "frame-desktop.png"
    And I alt-click the zoom of "install"
    Then there are 2 panes
    When I save a screenshot as "frame-desktop-split.png"
    Then there should be no page errors

  Scenario: A picture of a document page, with its contents shut
    Given I open the document "kitchen-sink.md"
    Then the contents is shut
    When I save a screenshot as "frame-document.png"
    Then there should be no page errors

  Scenario: A picture of the health dot's list, open on a desktop
    Given I open the outline "house.olai"
    When I open the health popover
    And I save a screenshot as "frame-dot-list.png"
    Then there should be no page errors

  @phone
  Scenario: A picture of the frame on a phone, page and drawer
    Given I open the outline "house.olai"
    When I save a screenshot as "frame-phone.png"
    And I tap the burger
    And I save a screenshot as "frame-phone-drawer.png"
    Then there should be no page errors
