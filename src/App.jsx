import { useState, useEffect, useCallback } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import ProcessList from './components/ProcessList'
import ProcessDetail from './components/ProcessDetail'
import ProcessForm from './components/ProcessForm'
import OrgManager from './components/OrgManager'
import LoginScreen from './components/LoginScreen'
import UserManager from './components/UserManager'
import PendingApprovals from './components/PendingApprovals'
import MySubmissions from './components/MySubmissions'
import { useAuth } from './contexts/AuthContext'
import { getProcesses } from './utils/api'
import './App.css'

function App() {
  const { user, permissions, loading: authLoading } = useAuth()
  const [currentView, setCurrentView] = useState('dashboard')
  const [selectedProcess, setSelectedProcess] = useState(null)
  const [prevView, setPrevView] = useState('dashboard')
  const [filterOrg, setFilterOrg] = useState('')
  const [initialBpmn, setInitialBpmn] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [processes, setProcesses] = useState([])
  const [loading, setLoading] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const loadProcesses = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getProcesses()
      setProcesses(data)
    } catch (err) {
      console.error('Failed to load processes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Only fetch processes once the user is authenticated.
  // Without this, the query fires before the Supabase session is set,
  // RLS blocks it, and the list stays empty even after login.
  useEffect(() => {
    if (user) loadProcesses()
  }, [user, loadProcesses])

  const handleNavigate = (view, process = null, options = {}) => {
    setPrevView(currentView)
    setCurrentView(view)
    setSelectedProcess(process || null)
    setFilterOrg(options.filterOrg || '')
    setInitialBpmn(options.initialBpmn || null)
  }

  const handleDelete = (id) => {
    setProcesses(prev => prev.filter(p => p.id !== id))
    setCurrentView('processes')
    setSelectedProcess(null)
  }

  const handleSave = (saved) => {
    setProcesses(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]
    })
    setSelectedProcess(saved)
    setCurrentView('detail')
  }

  const handleCancel = () => {
    if (selectedProcess) {
      setCurrentView('detail')
    } else {
      setCurrentView(prevView || 'processes')
    }
  }

  const renderView = () => {
    if (loading) {
      return <div className="loading-screen">Loading processes...</div>
    }
    switch (currentView) {
      case 'dashboard':
        return <Dashboard processes={processes} onNavigate={handleNavigate} />
      case 'processes':
        return (
          <ProcessList
            processes={processes}
            onNavigate={handleNavigate}
            onDelete={handleDelete}
            onRefresh={loadProcesses}
            initialFilterOrg={filterOrg}
            permissions={permissions}
          />
        )
      case 'detail':
        return (
          <ProcessDetail
            process={selectedProcess}
            onNavigate={handleNavigate}
            onDelete={handleDelete}
            onSave={handleSave}
            permissions={permissions}
          />
        )
      case 'add':
        return (
          <ProcessForm
            processes={processes}
            onSave={(saved) => { handleSave(saved); loadProcesses() }}
            onCancel={handleCancel}
            permissions={permissions}
            initialBpmn={initialBpmn}
          />
        )
      case 'edit':
        return (
          <ProcessForm
            process={selectedProcess}
            processes={processes}
            onSave={(saved) => { handleSave(saved); loadProcesses() }}
            onCancel={handleCancel}
            permissions={permissions}
          />
        )
      case 'orgs':
        return <OrgManager onNavigate={handleNavigate} />
      case 'approvals':
        return <PendingApprovals onNavigate={handleNavigate} onCountChange={setPendingCount} onRefresh={loadProcesses} />
      case 'my-submissions':
        return <MySubmissions onNavigate={handleNavigate} />
      case 'users':
        return <UserManager onNavigate={handleNavigate} />
default:
        return <Dashboard processes={processes} onNavigate={handleNavigate} />
    }
  }

  if (authLoading) {
    return <div className="loading-screen" style={{ height: '100vh' }}>Loading...</div>
  }

  if (!user) {
    return <LoginScreen />
  }

  return (
    <div className="app-shell">
      <Navbar
        onToggleSidebar={() => setSidebarCollapsed(c => !c)}
        pendingCount={pendingCount}
        onAddProcess={permissions.add ? () => handleNavigate('add') : null}
      />
      <div className="app-body">
        <Sidebar
          collapsed={sidebarCollapsed}
          currentView={currentView}
          onNavigate={handleNavigate}
          processes={processes}
          permissions={permissions}
          pendingCount={pendingCount}
        />
        <main className="main-content">
          {renderView()}
        </main>
      </div>
    </div>
  )
}

export default App
