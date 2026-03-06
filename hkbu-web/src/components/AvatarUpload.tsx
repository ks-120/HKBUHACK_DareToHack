import { useRef, useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import s from './AvatarUpload.module.css'

// ── Cloudinary config (free, no credit card) ──────────────────────────────
// 1. Sign up free at https://cloudinary.com/users/register/free
// 2. Dashboard → note your Cloud name
// 3. Settings → Upload → Upload presets → Add upload preset → Signing mode: Unsigned
const CLOUD_NAME   = 'dfmzbrn3q'    // e.g. 'dxyz1234'
const UPLOAD_PRESET = 'avatar_unsigned' // e.g. 'avatar_unsigned'
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  uid: string
  currentURL?: string
  nickname: string
  onUploaded: (url: string) => void
}

export default function AvatarUpload({ uid, currentURL, nickname, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview]   = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError]       = useState('')

  const handleFile = async (file: File) => {
    setError('')
    if (!file.type.startsWith('image/')) return setError('Please select an image file.')
    if (file.size > 5 * 1024 * 1024) return setError('Image must be under 5 MB.')

    // Instant local preview
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    // ── Upload to Cloudinary (free unsigned upload, no backend needed) ──
    try {
      setProgress(0)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', UPLOAD_PRESET)
      formData.append('public_id', `avatars/${uid}`)   // overwrite same slot each time
      formData.append('folder', 'avatars')

      // Cloudinary doesn't support upload progress with fetch, use XHR for that
      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`)
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100))
        }
        xhr.onload = () => {
          if (xhr.status === 200) {
            const res = JSON.parse(xhr.responseText)
            // Use secure_url and append a cache-buster so React re-renders the img
            resolve(`${res.secure_url}?v=${Date.now()}`)
          } else {
            reject(new Error(`Cloudinary error ${xhr.status}: ${xhr.responseText}`))
          }
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(formData)
      })

      // Save URL to Firestore
      const user = auth.currentUser
      if (user) {
        await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true })
      }

      onUploaded(url)
      setProgress(null)
    } catch (err: unknown) {
      console.error('Upload error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Must supply')) {
        setError('Invalid upload preset. Check UPLOAD_PRESET in AvatarUpload.tsx.')
      } else if (msg.includes('cloud_name')) {
        setError('Invalid cloud name. Check CLOUD_NAME in AvatarUpload.tsx.')
      } else {
        setError(`Upload failed: ${msg}`)
      }
      setProgress(null)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const displayURL = preview ?? currentURL
  const initials = nickname?.[0]?.toUpperCase() ?? '?'

  return (
    <div className={s.wrap}>
      <div
        className={s.avatarRing}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        title="Click or drag to upload photo"
      >
        {displayURL
          ? <img src={displayURL} alt="avatar" className={s.avatarImg} />
          : <div className={s.avatarInitials}>{initials}</div>
        }
        <div className={s.overlay}>
          {progress !== null ? `${progress}%` : '📷'}
        </div>
      </div>
      <input
        ref={inputRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handleChange}
      />
      <p className={s.hint}>Click or drag to upload photo<br />(max 5 MB)</p>
      {error && <p className={s.error}>{error}</p>}
    </div>
  )
}
