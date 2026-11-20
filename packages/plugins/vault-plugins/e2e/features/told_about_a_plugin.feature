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

  THE DONE SIGNAL IS THE AGENT SAYING SO — `vault-plugins_run`, answered with no
  fault, at the version on disk; the guide already requires that call as the
  last act of a build. It is WRITTEN DOWN on the plugin's settings node, beside
  the person's own consent, because a laptop that reboots mid-week
  is an ordinary day and a signal kept in a process is gone by Monday. The page
  keeps a way past it anyway, for the conversation nobody ever finished.

  AND A VERSION NOBODY HAS APPROVED IS STILL COMPILED. Approving is the one
  gesture in this product where a person is trusting code; being the only way
  to discover the code does not compile is the worst possible ordering of those
  two acts.

  @alerts
  Scenario: Nothing rings until the agent says the folder is finished
    Given I open the app
    And the notification worker is ready
    When a conversation about the plugin "timer" called "Timer"
    And I rewrite "plugins/timer/README.md" as:
      """
      ---
      chat-agent-session: claude
      ---
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
    Given I open the app
    When a conversation about the plugin "timer" called "Timer"
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
    Given I open the app
    When a conversation about the plugin "timer" called "Timer"
    And I rewrite "plugins/timer/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      export default definePlugin({ name: "timer", needs: [], apply: (
      """
    And I go to the plugin "timer"
    And I read the unfinished plugin "timer" anyway
    Then the plugin page is "broken"
    And the Plugins row "timer" is "building"
    And the plugin page's verb is "ask-fix"
    When I press the plugin page verb
    Then the plugin page says "There was no agent to take it" came of asking
    And there should be no page errors

  @alerts
  Scenario: A run that found a fault is the middle of a build, not the end
    Given I open the app
    And the notification worker is ready
    When a conversation about the plugin "timer" called "Timer"
    And I rewrite "plugins/timer/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      export default definePlugin({ name: "timer", needs: [], apply: (
      """
    And I go to the plugin "timer"
    Then the plugin page is "building"
    And the plugin "timer" has written "server.ts"
    When the terminal agent runs the plugin "timer"
    Then the plugin run says it cannot start
    And the Plugins row "timer" is "building"
    And no notification has been raised

    When I rewrite "plugins/timer/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({ name: "timer", needs: [], apply: Effect.void })
      """
    And I read the unfinished plugin "timer" anyway
    Then the plugin page is "review"
    When the terminal agent runs the plugin "timer"
    Then the Plugins row "timer" is "review"
    And the notification is titled "Timer is ready for you"
    And there should be no page errors

  Scenario: A build that finished before a reboot is still finished after one
    Given I open the app
    When a conversation about the plugin "timer" called "Timer"
    And I rewrite "plugins/timer/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({ name: "timer", needs: [], apply: Effect.void })
      """
    And I go to the plugin "timer"
    Then the plugin page is "building"
    And the plugin "timer" has written "server.ts"
    When the terminal agent runs the plugin "timer"
    Then the plugin page is "review"

    When the server stops
    And the server starts again on the same port
    And I go to the plugin "timer"
    Then the plugin page is "review"
    And the Plugins row "timer" is "review"
    And the plugin page's verb is "turn-on"
    And there should be no page errors

