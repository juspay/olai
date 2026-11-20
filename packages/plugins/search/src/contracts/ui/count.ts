export interface Drawn {
  readonly drawn: number
  readonly total: number
}

const behindTheRows = ({ drawn, total }: Drawn): number => total - drawn

export const countLine = (answer: Drawn): string | null =>
  behindTheRows(answer) > 0
    ? `${answer.drawn} of ${answer.total} matches`
    : null
