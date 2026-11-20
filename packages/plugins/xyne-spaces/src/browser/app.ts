export interface PillLook {
  readonly PILL: string
  readonly DOT: string
}

export interface SpacesApp {
  readonly desktop: () => boolean
  readonly pill: PillLook
}
