export interface WaitingFace {
  readonly mark: "waiting" | undefined
  readonly busy: "true" | undefined
}

const WAITING: WaitingFace = { mark: "waiting", busy: "true" }
const SETTLED: WaitingFace = { mark: undefined, busy: undefined }

export const waitingFace = (waiting: boolean): WaitingFace => waiting ? WAITING : SETTLED
