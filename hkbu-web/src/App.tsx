import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from './config/firebaseConfig'

import AppLayout from './components/AppLayout'
import WelcomePage from './pages/WelcomePage'
import SignUpPage from './pages/SignUpPage'
import LoginPage from './pages/LoginPage'
import MainPage from './pages/MainPage'
import MatchPage from './pages/MatchPage'
import EventsPage from './pages/EventsPage'
import FeedPage from './pages/FeedPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import InboxPage from './pages/InboxPage'

function ProtectedRoute({ user, children }: { user: User | null; children: JSX.Element }) {
  if (!user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u))
    return unsub
  }, [])

  if (user === undefined) return null

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={user ? <Navigate to="/main" replace /> : <WelcomePage />} />
        <Route path="/signup" element={user ? <Navigate to="/main" replace /> : <SignUpPage />} />
        <Route path="/login" element={user ? <Navigate to="/main" replace /> : <LoginPage />} />

        {/* Protected routes — all share the sidebar layout */}
        <Route element={<ProtectedRoute user={user}><AppLayout /></ProtectedRoute>}>
          <Route path="/main" element={<MainPage />} />
          <Route path="/match" element={<MatchPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/chat/:matchId/:matchNickname/:otherUid" element={<ChatPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
