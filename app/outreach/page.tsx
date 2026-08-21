import { getOutreachContacts } from '@/lib/db'
import Kanban from './Kanban'

export const dynamic = 'force-dynamic'

export default async function OutreachPage() {
  const contacts = await getOutreachContacts()
  return <Kanban initialContacts={contacts} />
}
