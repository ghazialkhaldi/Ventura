import { useEffect } from 'react'
import { useRouter } from 'next/router'

// Legacy route — redirect to the new Upload Data page
export default function UploadsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/upload-data') }, [router])
  return null
}
