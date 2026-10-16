import { useEffect, useState } from 'react'
import { loadData, saveData } from './store.js'
import Login from './components/Login.jsx'
import CustomerPortal from './components/CustomerPortal.jsx'
import AdminPortal from './components/AdminPortal.jsx'

export default function App() {
  const [data, setData] = useState(loadData)
  const [session, setSession] = useState(null) // { role: 'customer'|'admin', id }

  useEffect(() => saveData(data), [data])

  if (!session) return <Login data={data} onLogin={setSession} />

  return (
    <div className="app">
      <header className="topbar">
        <h1>🚗 DriveEasy Driving School</h1>
        <div>
          <span className="who">
            {session.role === 'admin'
              ? 'Administrator'
              : data.customers.find((c) => c.id === session.id)?.name}
          </span>
          <button className="ghost" onClick={() => setSession(null)}>Sign out</button>
        </div>
      </header>

      {session.role === 'customer' ? (
        <CustomerPortal
          customer={data.customers.find((c) => c.id === session.id)}
          appointments={data.appointments}
          update={(fn) => setData((d) => ({ ...d, ...fn(d) }))}
        />
      ) : (
        <AdminPortal data={data} setData={setData} />
      )}
    </div>
  )
}