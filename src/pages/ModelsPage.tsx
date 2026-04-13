import { useState } from 'react'
import { CachedModelsTable } from '../components/CachedModelsTable'

export function ModelsPage(): React.ReactElement {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Models</h1>
      <div className="flex flex-col gap-4">
        <CachedModelsTable key={refreshKey} onCacheChanged={() => setRefreshKey((k) => k + 1)} />
        {/* ModelDownloader wired in Plan 03 */}
      </div>
    </div>
  )
}
