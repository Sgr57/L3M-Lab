import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { ComparePage } from './pages/ComparePage'
import { SettingsPage } from './pages/SettingsPage'
import { useWebGPU } from './hooks/useWebGPU'

export default function App() {
  useWebGPU()

  return (
    <BrowserRouter>
      <NavBar />
      <main className="mx-auto max-w-[1200px] px-8 py-6">
        <Routes>
          <Route path="/" element={<ComparePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
