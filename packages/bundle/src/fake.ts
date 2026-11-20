export interface Fake {
  readonly word: string;
  readonly adapter?: { readonly knob: string; readonly exe: string };
  readonly searchPath?: string;
  readonly path?: string;
  readonly env?: (asked: {
    readonly on: boolean;
    readonly stored: boolean;
    readonly variants: ReadonlyArray<string>;
  }) => Readonly<Record<string, string>>;
  readonly variants?: ReadonlyArray<string>;
}
