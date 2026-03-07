import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { usePortalChat } from '@/features/portal/hooks/usePortalData'
import { useToast } from '@/shared/hooks/useToast'

export function PortalChat({ token }: { token: string }) {
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const mutation = usePortalChat(token)
  const toast = useToast()

  // Obsługa wyboru pliku i podglądu
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    if (f) {
      const reader = new FileReader()
      reader.onload = (ev) => setFilePreview(ev.target?.result as string)
      reader.readAsDataURL(f)
    } else {
      setFilePreview(null)
    }
  }

  // Wysyłka wiadomości z opcjonalnym zdjęciem
  const handleSend = async () => {
    let finalMessage = message
    if (file && filePreview) {
      finalMessage += `\n[img:${filePreview}]`
    }
    mutation.mutate(finalMessage, {
      onSuccess: () => {
        setMessage('')
        setFile(null)
        setFilePreview(null)
        toast.success('Wiadomość wysłana')
      },
      onError: (error) => {
        const msg = error instanceof Error ? error.message : 'Spróbuj ponownie.'
        toast.error('Nie udało się wysłać', msg)
      },
    })
  }

  return (
    <div className="portal-chat">
      <Input label="Wiadomość" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Napisz wiadomość do wykonawcy" />
      <div style={{ margin: '10px 0 0 0' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#f7f8fa',
          border: '1px dashed #d0d4db',
          borderRadius: 8,
          padding: '10px 14px',
          cursor: 'pointer',
          fontSize: 14,
          color: '#444',
          fontWeight: 500,
          transition: 'border 0.2s',
        }}>
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#e6eaf0"/><path d="M7.5 16.5l3.5-4.5 2.5 3 3-4 3.5 5.5" stroke="#7b869a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8.5" cy="8.5" r="1.5" fill="#7b869a"/></svg>
          <span style={{ flex: 1 }}>Załącz zdjęcie (opcjonalnie)</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
        {filePreview && (
          <div style={{ margin: '10px 0 0 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={filePreview} alt="Podgląd załącznika" style={{ maxWidth: 70, maxHeight: 54, borderRadius: 6, border: '1px solid #e0e0e0', background: '#fafbfc', boxShadow: '0 1px 4px #e6eaf0' }} />
            <span style={{ fontSize: 13, color: '#7b869a', fontWeight: 400 }}>{file?.name}</span>
            <button type="button" onClick={() => { setFile(null); setFilePreview(null); }} style={{ background: 'none', border: 'none', color: '#b00', fontSize: 18, cursor: 'pointer', marginLeft: 4 }} title="Usuń załącznik">×</button>
          </div>
        )}
      </div>
      <Button style={{ marginTop: 16 }} onClick={handleSend}>Wyślij wiadomość</Button>
    </div>
  )
}
