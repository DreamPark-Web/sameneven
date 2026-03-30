import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default async function Home({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const params = await searchParams
  const invite = params.invite ? `?invite=${params.invite}` : ''

  if (user) redirect(`/picker${invite}`)
  else redirect(`/login${invite}`)
}