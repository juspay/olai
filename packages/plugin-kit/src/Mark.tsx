import { createUniqueId, type JSX } from "solid-js"

export interface BrandMarkProps {
  readonly viewBox: string
  readonly token: string
  readonly body: string
}

export const BrandMark = (props: BrandMarkProps): JSX.Element => {
  const uid = createUniqueId()
  return (
    <g>
      <svg
        x="0"
        y="0"
        width="100%"
        height="100%"
        viewBox={props.viewBox}
        preserveAspectRatio="xMidYMid meet"
        innerHTML={props.body.replaceAll(props.token, `${uid}-`)}
      />
    </g>
  )
}
