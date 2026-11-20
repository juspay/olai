export interface Press {
  readonly label: string
  readonly writes: boolean
}

export const pressOf = (
  stored: string | undefined,
  chosen: string,
  verbs: { readonly set: string; readonly clear: string },
): Press =>
  chosen === ""
    ? { label: stored === undefined ? verbs.set : verbs.clear, writes: stored !== undefined }
    : { label: verbs.set, writes: chosen !== stored }

export interface PanelIds {
  readonly panel: string
  readonly set: string
  readonly cancel: string
  readonly said: string
  readonly notice?: string
}
