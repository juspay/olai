@scratch:plugins
Feature: What a plugin tells you, and what it waits to tell you
  A plugin is a thing you ask for and walk away from. The conversation writes
  three files over a minute or several, and the page is almost never the thing
  a person is looking at while that happens — so the moments where the plugin
  is waiting on a PERSON have to travel to wherever they are.

  WHICH MOMENTS, EXACTLY, is the whole of this feature. It is ready to be read,
  it stopped because its code changed, or it could not start. Not "a file
  landed": the guide has the builder write the README, then `server.ts`, then
  `browser.tsx`, so a page that called a folder finished when its server half
  arrived rang *Ready for you* at a plugin whose face was still being written,
  and a person who pressed **Turn on** was paused by the very next write.

  THE DONE SIGNAL IS THE AGENT SAYING SO — `vault-plugins_run` at the version on
  disk, which the guide already requires as the last act of a build. It is this
  process's memory and nothing else, so the page keeps a way past it for the
  serve that was restarted mid-build and the conversation nobody finished.

  AND A VERSION NOBODY HAS APPROVED IS STILL COMPILED. Approving is the one
  gesture in this product where a person is trusting code; being the only way
  to discover the code does not compile is the worst possible ordering of those
  two acts.

  @alerts
  Scenario: Nothing rings until the agent says the folder is finished
    Given I open the app
    And the notification worker is ready
    # A FOLDER BEING WRITTEN: a conversation bound to it, and the files
    # arriving one at a time the way the guide tells an agent to write them.
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"timer-consent","ord":"a0","title":"timer","custom":{"builder":"timer-chat"}}
      """
    And I rewrite "plugins/timer/README.md" as:
      """
      # Timer

      Counts the minutes while you are not looking.
      """
    Then the Plugins row "timer" is "building"
    When I rewrite "plugins/timer/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({ name: "timer", needs: [], apply: Effect.void })
      """
    # ...AND STILL BEING BUILT, which is the regression this scenario is for:
    # the face has not landed and the agent has not said it is done. The page
    # is where the files that HAVE landed are listed, and reading it is also
    # this scenario's wait: writing a half straight to disk and speaking for
    # the agent in the next breath can beat the write to the serve, which an
    # agent writing through `vault-plugins_write` never does.
    When I go to the plugin "timer"
    Then the plugin page is "building"
    And the plugin "timer" has written "server.ts"
    And no notification has been raised

    When the terminal agent runs the plugin "timer"
    Then the Plugins row "timer" is "review"
    And the notification is titled "Timer is ready for you"
    And a notification says "An agent finished building it"
    When the notification is pressed
    Then the plugin page is about "timer"
    And the plugin page is "review"
    And there should be no page errors

  Scenario: A build nobody ever finished can still be read
    # The done signal is this process's memory: a serve restarted mid-build has
    # none, and an agent that stopped talking never sends one. The files are on
    # the screen, so what the page offers is reading what is actually there.
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"timer-consent","ord":"a0","title":"timer","custom":{"builder":"timer-chat"}}
      """
    And I rewrite "plugins/timer/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({ name: "timer", needs: [], apply: Effect.void })
      """
    And I go to the plugin "timer"
    Then the plugin page is "building"
    When I read the unfinished plugin "timer" anyway
    Then the plugin page is "review"
    And the plugin page's verb is "turn-on"
    And there should be no page errors

  @alerts
  Scenario: A plugin that stopped because its code changed says so
    # The state a person most needs told and the one that used to ring for
    # nobody: a plugin that was working is not working now, and nothing on
    # screen says so unless they happen to be looking at the sidebar.
    Given I open the app
    When I approve the plugin "greeting"
    And the notification worker is ready
    And I rewrite "plugins/greeting/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({ name: "greeting", needs: [], apply: Effect.void })
      """
    Then the notification is titled "Greeting is paused"
    And a notification says "Its code changed since you turned it on"
    And there should be no page errors

  @alerts
  Scenario: A folder nobody built with an agent is not said to have been built by one
    # The same screen, reached with no agent in it at all: a folder copied in
    # from another vault, or written by hand. "An agent finished building it"
    # is a sentence about how it got there, and that one would be false.
    Given I open the app
    And the notification worker is ready
    When I rewrite "plugins/clock/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({ name: "clock", needs: [], apply: Effect.void })
      """
    Then the Plugins row "clock" is "review"
    And the notification is titled "clock is ready for you"
    And a notification says "It is in your vault and nobody has read it yet"
    And there should be no page errors

  Scenario: Code that will not compile says so before anybody approves it
    # The *Mend* screen, reached without approving anything. `buildHalf` is a
    # transform over text — nothing is imported — so the fault is knowable at
    # exactly the moment a person would otherwise have had to trust the code to
    # find it out.
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"timer-consent","ord":"a0","title":"timer","custom":{"builder":"timer-chat"}}
      """
    And I rewrite "plugins/timer/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      export default definePlugin({ name: "timer", needs: [], apply: (
      """
    And I go to the plugin "timer"
    And I read the unfinished plugin "timer" anyway
    Then the plugin page is "broken"
    # The SIDEBAR still says it is being built, and that is right: *I'll read
    # it now* is this reader's decision about this page, not a fact about the
    # folder. The row moves when the agent says it is done.
    And the Plugins row "timer" is "building"
    # ...and the fault goes back to whoever wrote it, with what came of the
    # press drawn on the page rather than left to be guessed at.
    And the plugin page's verb is "ask-fix"
    When I press the plugin page verb
    Then the plugin page says "There was no agent to take it" came of asking
    And there should be no page errors
