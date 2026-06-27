import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function AnomalyRedirect() {
  const router = useRouter()
  useEffect(() => {
    const { id } = router.query
    if (id) router.replace(`/anomalies/${id}`)
  }, [router])
  return null
}
