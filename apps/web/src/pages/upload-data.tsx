import type { GetServerSideProps } from 'next'

// Connections now live on Integrations, where each system is connected by
// signing in to it directly.
export const getServerSideProps: GetServerSideProps = async () => ({ redirect: { destination: '/integrations', permanent: false } })

export default function UploadData() { return null }
