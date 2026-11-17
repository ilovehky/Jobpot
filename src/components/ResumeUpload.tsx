import { useId, useRef, useState, type DragEvent } from 'react'
import { api, ApiError } from '../api'
import { extractResumeText, resumeFileError } from '../lib/resumeText'

type Props = { onUploaded: () => void; actionLabel: string }

export function ResumeUpload({ onUploaded, actionLabel }: Props) {
  const [status, setStatus] = useState<'idle' | 'reading' | 'uploading'>('idle')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError('')
    const fileError = resumeFileError(file)
    if (fileError) return setError(fileError)

    try {
      setStatus('reading')
      const text = await extractResumeText(file)
      setStatus('uploading')
      const form = new FormData()
      form.append('file', file)
      form.append('text', text)
      await api('/resume', { form })
      onUploaded()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't open this file. Make sure it isn't password-protected, then try again.",
      )
    } finally {
      setStatus('idle')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    handleFile(event.dataTransfer.files[0])
  }

  const busy = status !== 'idle'
  return (
    <div className="upload">
      <label
        htmlFor={id}
        className={`dropzone${dragging ? ' is-dragging' : ''}${busy ? ' is-busy' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="dropzone-title">
          {status === 'reading' ? 'Reading your resume…' : status === 'uploading' ? 'Saving…' : actionLabel}
        </span>
        <span className="dropzone-hint">PDF or Word (.docx), up to 1.9 MB. Drop it here or click to choose.</span>
      </label>
      <input
        ref={inputRef}
        id={id}
        className="visually-hidden"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        disabled={busy}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
