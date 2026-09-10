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
    Then the plugins panel shows "swatch" configured "tone" as "blue"
    And the plugin "swatch" marks "tone" as authored by "vault"
    When I rewrite "definition.olai" as:
      """
      {"id":"swatch-policy","ord":"a0","title":"A configured definition","custom":{"plugin":"swatch","approved":"always","tone":"red"}}
      {"id":"swatch-server","ord":"a0","parent":"swatch-policy","title":"server.ts","desc":"import { definePlugin } from \"@olai/plugin-api\"; import { Effect, Schema } from \"effect\"; const Config = Schema.Struct({ tone: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"blue\")), Schema.annotate({ description: \"the swatch tone\" })) }); export default definePlugin({ name: \"swatch\", needs: [], config: Config, apply: (config) => config.tone === \"blue\" ? Effect.void : Effect.die(new Error(\"tone=\" + config.tone)) });"}
      """
    Then the plugins panel says "swatch" is "tone=red"
    And the plugins panel shows "swatch" configured "tone" as "red"
    When I rewrite "definition.olai" as:
      """
      {"id":"swatch-policy","ord":"a0","title":"A configured definition","custom":{"plugin":"swatch","approved":"always","tone":"blue"}}
      {"id":"swatch-server","ord":"a0","parent":"swatch-policy","title":"server.ts","desc":"import { definePlugin } from \"@olai/plugin-api\"; import { Effect, Schema } from \"effect\"; const Config = Schema.Struct({ tone: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"blue\")), Schema.annotate({ description: \"the swatch tone\" })) }); export default definePlugin({ name: \"swatch\", needs: [], config: Config, apply: (config) => config.tone === \"blue\" ? Effect.void : Effect.die(new Error(\"tone=\" + config.tone)) });"}
      """
    Then the plugins panel says nothing more about "swatch"
    And the plugins panel shows "swatch" configured "tone" as "blue"
    And there should be no page errors
