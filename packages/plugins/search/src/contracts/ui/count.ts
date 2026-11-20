export interface Drawn {
  readonly drawn: number
  readonly total: number
}

export const countLine = ({ drawn, total }: Drawn): string | null =>
  total > drawn ? `${drawn} of ${total} matches` : null
