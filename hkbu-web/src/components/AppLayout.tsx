import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { UserProfile } from '../types'
import Sidebar from './Sidebar'
import s from './Sidebar.module.css'
import HKBUChatBot from './HKBUChatBot'

export default function AppLayout() {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (uid) getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) setProfile(snap.data() as UserProfile)
    })
  }, [])

  return (
    <div className={s.appShell}>
      <Sidebar profile={profile} />
      <div className={s.mainContent}>
        <Outlet />
      </div>
      <HKBUChatBot />
    </div>
  )
}
