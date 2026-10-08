import { createSignal } from "solid-js"
import { render } from "solid-js/web"
import { SessionFileListV2 } from "@/pages/session/v2/session-file-list-v2"

function makeFiles(generation: number, count: number) {
  return Array.from({ length: count }, (_, index) => `generation-${generation}/file-${index}.ts`)
}

const [files, setFiles] = createSignal<readonly string[]>(makeFiles(0, 1_000))

declare global {
  interface Window {
    __virtualRowChurn?: {
      replaceRows: () => void
    }
  }
}

const replaceRows = () => {
  for (let generation = 1; generation <= 60; generation++) {
    const count = generation % 4 === 0 ? 0 : generation % 4 === 1 ? 1 : 250
    setFiles(makeFiles(generation, count))
  }
  setFiles(["final/keep.ts"])
}

window.__virtualRowChurn = { replaceRows }
document.querySelector('[data-testid="replace-rows"]')?.addEventListener("click", replaceRows)

render(
  () => <SessionFileListV2 files={files()} onFileClick={() => undefined} />,
  document.getElementById("root")!,
)
