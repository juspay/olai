import { useHistory } from "../history.ts"
import { MAKING_DOCUMENT } from "olai-plugin-files/making"
import { NewFile } from "../files.tsx"
import { useRouter } from "olai-plugin-navigation/routing"
import { mintAndOpen } from "./minted.ts"

export const documentMaking = () => MAKING_DOCUMENT("markdown")

export function NewDocument() {
  const undo = useHistory()
  const router = useRouter()

  return (
    <NewFile
      making={documentMaking()}
      create={(file) => mintAndOpen({ verb: "docNew", file }, undo.record, router)}
    />
  )
}
