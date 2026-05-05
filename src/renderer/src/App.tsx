import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { TranslatePage } from './pages/TranslatePage'
import { DictionaryPage } from './pages/DictionaryPage'
import { ExtractPage } from './pages/ExtractPage'
import { PackagePage } from './pages/PackagePage'
import { SettingsPage } from './pages/SettingsPage'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/translate" replace />} />
          <Route path="/translate" element={<TranslatePage />} />
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/extract" element={<ExtractPage />} />
          <Route path="/package" element={<PackagePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
