@scratch:good
Feature: A definition reads its own schema knobs
  Scenario: Changing a knob re-applies approved source and the panel shows its author
    Given I open the outline "house.olai"
    When I rewrite "definition.olai" as:
      """
      {"id":"swatch-policy","ord":"a0","title":"A configured definition","custom":{"plugin":"swatch","approved":"always","tone":"blue"}}
      {"id":"swatch-server","ord":"a0","parent":"swatch-policy","title":"server.ts","desc":"import { definePlugin } from \"@olai/plugin-api\"; import { Effect, Schema } from \"effect\"; const Config = Schema.Struct({ tone: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"blue\")), Schema.annotate({ description: \"the swatch tone\" })) }); export default definePlugin({ name: \"swatch\", needs: [], config: Config, apply: (config) => config.tone === \"blue\" ? Effect.void : Effect.die(new Error(\"tone=\" + config.tone)) });"}
      """
    And I open the plugins panel
    When I expand settings for the plugin "swatch"
    Then the plugins panel shows "swatch" configured "tone" as "blue"
    And the plugin "swatch" marks "tone" as authored by "vault"
    Given a terminal agent is connected to the served directory
    When the terminal agent inspects definition configuration
    Then the definition layout names its Config properties and reserved keys
    When the terminal agent runs definition "swatch"
    Then the definition run reports "tone" as "blue" from "vault"
    When I rewrite "definition.olai" as:
      """
      {"id":"swatch-policy","ord":"a0","title":"A configured definition","custom":{"plugin":"swatch","approved":"always","tone":"red"}}
      {"id":"swatch-server","ord":"a0","parent":"swatch-policy","title":"server.ts","desc":"import { definePlugin } from \"@olai/plugin-api\"; import { Effect, Schema } from \"effect\"; const Config = Schema.Struct({ tone: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"blue\")), Schema.annotate({ description: \"the swatch tone\" })) }); export default definePlugin({ name: \"swatch\", needs: [], config: Config, apply: (config) => config.tone === \"blue\" ? Effect.void : Effect.die(new Error(\"tone=\" + config.tone)) });"}
      """
    Then the plugins panel says "swatch" is "tone=red"
    When I expand settings for the plugin "swatch"
    Then the plugins panel shows "swatch" configured "tone" as "red"
    When I rewrite "definition.olai" as:
      """
      {"id":"swatch-policy","ord":"a0","title":"A configured definition","custom":{"plugin":"swatch","approved":"always","tone":"blue"}}
      {"id":"swatch-server","ord":"a0","parent":"swatch-policy","title":"server.ts","desc":"import { definePlugin } from \"@olai/plugin-api\"; import { Effect, Schema } from \"effect\"; const Config = Schema.Struct({ tone: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"blue\")), Schema.annotate({ description: \"the swatch tone\" })) }); export default definePlugin({ name: \"swatch\", needs: [], config: Config, apply: (config) => config.tone === \"blue\" ? Effect.void : Effect.die(new Error(\"tone=\" + config.tone)) });"}
      """
    Then the plugins panel says nothing more about "swatch"
    When I expand settings for the plugin "swatch"
    Then the plugins panel shows "swatch" configured "tone" as "blue"
    And there should be no page errors
