import { Outlet } from 'react-router-dom'
import Footer from './Footer'
import Header from './Header'
import Chatbot from './Chatbot'

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="min-h-[calc(100vh-4rem)]">
        <Outlet />
      </main>
      <Footer />
      <Chatbot />
    </div>
  )
}
