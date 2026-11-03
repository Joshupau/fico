// Run: npx tsx scripts/test-triage.mts
import { noteKey, suggestCategory } from '../utils/triage'

let failures = 0
let passes = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (ok) passes++
  else {
    failures++
    console.log('FAIL', label, JSON.stringify(extra))
  }
}

const categories = [
  { id: 'food', name: 'Food & Dining', type: 'expense' },
  { id: 'transport', name: 'Transportation', type: 'expense' },
  { id: 'subs', name: 'Subscriptions', type: 'expense' },
  { id: 'salary', name: 'Salary', type: 'income' },
]
const history = [
  { description: 'Grab Philippines', categoryId: 'transport', type: 'expense' },
  { description: 'GRAB PHILIPPINES', categoryId: 'transport', type: 'expense' },
  { description: 'Grab Philippines', categoryId: 'food', type: 'expense' }, // a GrabFood order once
  { description: 'Spotify', categoryId: 'subs', type: 'expense' },
]

check('note key ignores case, spaces and refs', noteKey('  GRAB  Philippines 927809084 ') === 'grab philippines', noteKey('  GRAB  Philippines 927809084 '))
const grab = suggestCategory({ description: 'Grab Philippines', type: 'expense' }, history, categories)
check('most used category for the same note wins', grab?.category.id === 'transport' && grab.reason === 'history', grab)
const spotify = suggestCategory({ description: 'SPOTIFY', type: 'expense' }, history, categories)
check('history match is case-insensitive', spotify?.category.id === 'subs', spotify)
const jollibee = suggestCategory({ description: 'Jollibee', type: 'expense' }, history, categories)
check('falls back to reading the note', jollibee?.category.id === 'food' && jollibee.reason === 'note', jollibee)
const wrongType = suggestCategory({ description: 'Grab Philippines', type: 'income' }, history, categories)
check('never suggests an expense category for income', wrongType === null || wrongType.category.type === 'income', wrongType)
check('no note, no suggestion', suggestCategory({ description: '', type: 'expense' }, history, categories) === null)

console.log(`${passes} passed, ${failures} failed`)
if (failures) process.exit(1)
