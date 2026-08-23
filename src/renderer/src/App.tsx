import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { MainLayout } from './components/layout/MainLayout'
import { MergeSessionProvider } from './context/MergeSession'
import { TranslationSessionProvider } from './context/TranslationSession'
import { DictionaryPage } from './pages/DictionaryPage'
import { EntryEditPage } from './pages/EntryEditPage'
import { ExtractPage } from './pages/ExtractPage'
import { ManageModsPage } from './pages/ManageModsPage'
import { MergeToolPage } from './pages/MergeToolPage'
import { MetricsPage } from './pages/MetricsPage'
import { PackagePage } from './pages/PackagePage'
import { SettingsPage } from './pages/SettingsPage'
import { TranslatePage } from './pages/TranslatePage'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Toaster position="bottom-right" theme="dark" richColors />
      <Routes>
        <Route
          element={
            <TranslationSessionProvider>
              <MergeSessionProvider>
                <MainLayout />
              </MergeSessionProvider>
            </TranslationSessionProvider>
          }
        >
          <Route index element={<Navigate to="/translate" replace />} />
          <Route element={<Outlet />}>
            <Route path="/translate" element={<TranslatePage />} />
            <Route path="/translate/entry/:uid" element={<EntryEditPage />} />
          </Route>
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/mods" element={<ManageModsPage />} />
          <Route path="/extract" element={<ExtractPage />} />
          <Route path="/package" element={<PackagePage />} />
          <Route path="/merge" element={<MergeToolPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
