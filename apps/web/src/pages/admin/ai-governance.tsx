import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function AdminAIGovernanceRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/ai-governance') }, [router])
  return null
}
