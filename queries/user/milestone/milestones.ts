// Reached milestones (table `milestones`, migration 0068): each is celebrated once, and goal and
// debt cards draw their journey from them. Plain table reads and writes, so they work offline.

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabase-client'
import { celebrate } from '@/store/celebration-store'
import { milestoneKey, newMilestones, type Milestone, type MilestoneKind } from '@/utils/milestones'

export interface ReachedMilestone {
  id: string
  kind: MilestoneKind
  subjectId: string
  level: string
  title: string | null
  reachedAt: string
}

export const MILESTONES_KEY = ['milestones']
const enabledBackend = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase'

async function listMilestones(): Promise<ReachedMilestone[]> {
  if (!enabledBackend()) return []
  const { data, error } = await supabase.from('milestones').select('*').order('reached_at', { ascending: true })
  if (error) throw error
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    kind: r.kind,
    subjectId: String(r.subject_id),
    level: String(r.level),
    title: r.title ?? null,
    reachedAt: String(r.reached_at),
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export const useReachedMilestones = () => useQuery({ queryKey: MILESTONES_KEY, queryFn: listMilestones, retry: false })

/** Milestones reached for one goal, debt or investment, oldest first. */
export const useSubjectMilestones = (kind: MilestoneKind, subjectId: string) => {
  const { data } = useReachedMilestones()
  return (data ?? []).filter((m) => m.kind === kind && m.subjectId === subjectId)
}

/**
 * Shows the biggest milestone not reached before (a quick check, a short card or full confetti) and
 * remembers all of them. Returns the ones shown. A failed save (table not on the server yet) is
 * ignored: the device still remembers them locally.
 */
export async function celebrateMilestones(queryClient: QueryClient, found: Milestone[]): Promise<Milestone[]> {
  if (found.length === 0 || !enabledBackend()) return []
  let reached = queryClient.getQueryData<ReachedMilestone[]>(MILESTONES_KEY)
  if (!reached) reached = await queryClient.fetchQuery({ queryKey: MILESTONES_KEY, queryFn: listMilestones }).catch(() => [])
  const fresh = newMilestones(found, reached.map(milestoneKey))
  if (fresh.length === 0) return []

  for (const m of fresh) {
    const { error } = await supabase.from('milestones').insert({ kind: m.kind, subject_id: m.subjectId, level: m.level, title: m.title })
    // 23505: another device got there first. Anything else: still celebrate, it just won't be remembered.
    if (error && error.code !== '23505') console.warn('[milestones] could not save', error.message)
  }
  void queryClient.invalidateQueries({ queryKey: MILESTONES_KEY })

  const top = fresh[0]
  const message = [top.message, top.detail].filter(Boolean).join(' ')
  if (top.size === 'big') celebrate({ kind: 'confetti', title: top.title, message })
  else if (top.size === 'medium') celebrate({ kind: 'coins', title: top.title, message })
  else toast.success(`${top.title}. ${message}`, { duration: 4500 })
  return fresh
}

export const useCelebrateMilestones = () => {
  const queryClient = useQueryClient()
  return (found: Milestone[]) => celebrateMilestones(queryClient, found)
}
