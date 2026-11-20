import { TESTID } from "olai-plugin-outlines/testids"
import type { Row } from "@olai/format"
import type { JSX } from "solid-js"

import { GLYPH_BOX } from "@olai/ui-primitives/touch.ts"

import { useDragging } from "./dragging.ts"

export function Handle(props: {
  readonly row: Row
  readonly children: JSX.Element
}) {
  const dragging = useDragging()
  return (
    <span
      class={`${GLYPH_BOX} md:cursor-grab`}
      data-testid={TESTID.dragHandle}
      data-handle=""
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => dragging.grab(event, props.row)}
      onContextMenu={dragging.heldMenu}
      on:click={{
        capture: true,
        handleEvent: (event: MouseEvent) => {
          if (!dragging.dragged()) return
          event.preventDefault()
          event.stopPropagation()
        },
      }}
    >
      {props.children}
    </span>
  )
}
