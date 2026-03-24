import { useState, useEffect, useCallback } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import ProcessList from './components/ProcessList'
import ProcessDetail from './components/ProcessDetail'
import ProcessForm from './components/ProcessForm'
import OrgManager from './components/OrgManager'
import { getProcesses } from './utils/api'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState('dashboard')
  const [selectedProcess, setSelectedProcess] = useState(null)
  const [prevView, setPrevView] = useState('dashboard')
  const [filterOrg, setFilterOrg] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [processes, setProcesses] = useState([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => { loadProcesses() }, [loadProcesses])

  const handleNavigate = (view, process = null, options = {}) => {
    setPrevView(currentView)
    setCurrentView(view)
    setSelectedProcess(process || null)
    setFilterOrg(options.filterOrg || '')
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
          />
        )
      case 'detail':
        return (
          <ProcessDetail
            process={selectedProcess}
            onNavigate={handleNavigate}
            onDelete={handleDelete}
            onSave={handleSave}
          />
        )
      case 'add':
        return (
          <ProcessForm
            processes={processes}
            onSave={(saved) => { handleSave(saved); loadProcesses() }}
            onCancel={handleCancel}
          />
        )
      case 'edit':
        return (
          <ProcessForm
            process={selectedProcess}
            processes={processes}
            onSave={(saved) => { handleSave(saved); loadProcesses() }}
            onCancel={handleCancel}
          />
        )
      case 'orgs':
        return <OrgManager onNavigate={handleNavigate} />
      default:
        return <Dashboard processes={processes} onNavigate={handleNavigate} />
    }
  }

  return (
    <div className="app-shell">
      <Navbar onToggleSidebar={() => setSidebarCollapsed(c => !c)} />
      <div className="app-body">
        <Sidebar
          collapsed={sidebarCollapsed}
          currentView={currentView}
          onNavigate={handleNavigate}
          processes={processes}
        />
        <main className="main-content">
          {renderView()}
        </main>
      </div>
    </div>
  )
}

export default App
