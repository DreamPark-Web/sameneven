import { UserProvider } from '@/lib/user-context'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <UserProvider>{children}</UserProvider>
}
