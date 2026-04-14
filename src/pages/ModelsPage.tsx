import { useRef } from 'react'
import { CachedModelsTable } from '../components/CachedModelsTable'
import type { CachedModelsTableHandle } from '../components/CachedModelsTable'
import { ModelDownloader } from '../components/ModelDownloader'

export function ModelsPage(): React.ReactElement {
  const tableRef = useRef<CachedModelsTableHandle>(null)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Models</h1>
      <div className="flex flex-col gap-4">
        <CachedModelsTable ref={tableRef} />
        <ModelDownloader onDownloadComplete={() => tableRef.current?.refresh()} />
      </div>
    </div>
  )
}
