# Cursor Prompt: Integrate Bank Records Dashboard into Leo Planner Safe Section

---

## CONTEXT

Leo Planner is a React + TypeScript + Vite + Supabase PWA.  
We are adding a new **"Bank Records"** category inside the existing **Safe section**.  
The dashboard component already exists as a standalone file: `src/components/safe/BankDashboard.tsx`  
(You have already dropped this file into the project — do NOT rewrite its internals.)

---

## YOUR TASK

Integrate `BankDashboard.tsx` into Leo Planner by completing ALL of the following steps:

---

### STEP 1 — Install dependencies

Run in terminal:
```bash
npm install recharts xlsx
```

`recharts` is used for pie/bar/area charts inside the dashboard.  
`xlsx` (SheetJS) is used for Excel file parsing in the upload feature.

---

### STEP 2 — Add "Bank Records" as a Safe category

Find the file where Safe categories are defined. It will look something like:
```ts
// Likely in: src/types/safe.ts  OR  src/components/safe/SafeSection.tsx
type SafeCategory = 'login' | 'credit_card' | 'identity' | 'document'
```

Add `'bank_records'` to this union type:
```ts
type SafeCategory = 'login' | 'credit_card' | 'identity' | 'document' | 'bank_records'
```

Also find the category display config (the array/object that maps categories to labels and icons) and add:
```ts
{
  id: 'bank_records',
  label: 'Bank Records',
  icon: '🏦',
  description: 'FDs, accounts, bills & maturity tracker'
}
```

---

### STEP 3 — Wire the Safe section to render BankDashboard

Find the Safe section's main render logic. It will have a pattern like:
```tsx
// Likely in: src/components/safe/SafeSection.tsx  OR  src/pages/SafePage.tsx
{selectedCategory === 'login' && <LoginList />}
{selectedCategory === 'credit_card' && <CreditCardList />}
```

Add the Bank Records case:
```tsx
import BankDashboard from './BankDashboard'

{selectedCategory === 'bank_records' && (
  <BankDashboard supabase={supabase} userId={user?.id} />
)}
```

The `BankDashboard` component accepts two optional props: `supabase` and `userId`.  
If your Safe section doesn't pass supabase/user directly, pass them from context — see Step 5.

---

### STEP 4 — Add routing / deep link support

Find the router config. It will be in `src/App.tsx` or a dedicated routes file. Leo Planner likely uses React Router or a hash-based router.

Add a route so the Bank Records dashboard is directly linkable:
```tsx
// If using React Router v6:
<Route path="/safe/bank-records" element={<SafePage defaultCategory="bank_records" />} />

// If using hash routing:
// Add '#/safe/bank-records' as a recognised hash that sets selectedCategory to 'bank_records'
```

Also add a `defaultCategory` prop to `SafePage` / `SafeSection` if it doesn't already exist:
```tsx
interface SafePageProps {
  defaultCategory?: SafeCategory
}

// Inside component:
const [selectedCategory, setSelectedCategory] = useState<SafeCategory>(
  props.defaultCategory ?? 'login'
)
```

---

### STEP 5 — Replace artifact storage with Supabase

`BankDashboard.tsx` currently uses `window.storage` (artifact storage) to persist data.  
Replace this with Supabase so data is encrypted and synced with the user's account.

#### 5a — Create a Supabase table

Run this SQL in your Supabase dashboard (SQL editor):
```sql
create table if not exists bank_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Each user has exactly one bank_records row
create unique index if not exists bank_records_user_idx on bank_records(user_id);

-- Row Level Security
alter table bank_records enable row level security;

create policy "Users can read own bank records"
  on bank_records for select
  using (auth.uid() = user_id);

create policy "Users can upsert own bank records"
  on bank_records for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bank records"
  on bank_records for update
  using (auth.uid() = user_id);
```

#### 5b — Update BankDashboard.tsx props interface

At the top of `BankDashboard.tsx`, add a props interface:
```tsx
interface BankDashboardProps {
  supabase?: SupabaseClient
  userId?: string
}

export default function BankDashboard({ supabase, userId }: BankDashboardProps) {
```

#### 5c — Replace the storage useEffect

Find the `useEffect` that calls `window.storage.get("bank-records-v3")` and replace it:

```tsx
useEffect(() => {
  (async () => {
    try {
      if (supabase && userId) {
        // Load from Supabase
        const { data, error } = await supabase
          .from('bank_records')
          .select('data')
          .eq('user_id', userId)
          .single()

        if (data?.data) {
          const parsed = data.data
          setDeposits(parsed.deposits || [])
          setAccounts(parsed.accounts || [])
          setBills(parsed.bills || [])
          setActions(parsed.actions || [])
        } else {
          // First launch — seed with preloaded Excel data
          setDeposits(PRELOAD_DATA.deposits)
          setAccounts(PRELOAD_DATA.accounts)
          setBills(PRELOAD_DATA.bills)
          setActions([])
        }
      } else {
        // Fallback: use window.storage (dev/standalone mode)
        const r = await window.storage?.get("bank-records-v3")
        if (r?.value) {
          const parsed = JSON.parse(r.value)
          setDeposits(parsed.deposits || [])
          setAccounts(parsed.accounts || [])
          setBills(parsed.bills || [])
          setActions(parsed.actions || [])
        } else {
          setDeposits(PRELOAD_DATA.deposits)
          setAccounts(PRELOAD_DATA.accounts)
          setBills(PRELOAD_DATA.bills)
          setActions([])
        }
      }
    } catch (e) {
      console.error('BankDashboard load error:', e)
      setDeposits(PRELOAD_DATA.deposits)
      setAccounts(PRELOAD_DATA.accounts)
      setBills(PRELOAD_DATA.bills)
      setActions([])
    }
    setLoading(false)
  })()
}, [supabase, userId])
```

#### 5d — Replace the persist function

Find the `persist()` function that calls `window.storage.set(...)` and replace it:

```tsx
async function persist(deps: Deposit[], accs: Account[], bls: Bill[], acts: Action[]) {
  const payload = { deposits: deps, accounts: accs, bills: bls, actions: acts }
  try {
    if (supabase && userId) {
      await supabase
        .from('bank_records')
        .upsert(
          { user_id: userId, data: payload, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
    } else {
      await window.storage?.set("bank-records-v3", JSON.stringify(payload))
    }
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  } catch (e) {
    console.error('BankDashboard save error:', e)
  }
}
```

---

### STEP 6 — Match Leo Planner's theme

BankDashboard uses its own dark theme (`#0D1117`, `#1C1C2E`). Check if Leo Planner uses CSS variables or a theme context.

If Leo Planner has CSS variables like `--bg-primary`, `--bg-card`, `--text-primary`, `--accent-blue` etc., update the inline styles in `BankDashboard.tsx` to reference them:

```tsx
// Replace hardcoded colours like:
background: "#1C1C2E"
// With:
background: "var(--bg-card)"
```

If Leo Planner uses Tailwind, wrap the dashboard in Leo's standard card/page container class instead of the full-page div.

If Leo Planner has a `<PageHeader>` or `<SectionHeader>` component, replace the dashboard's header div with that component for visual consistency.

---

### STEP 7 — Wire Excel upload to Leo's file handling

Leo Planner may have an existing file upload utility. If it does, use it. If not, the dashboard has its own `<input type="file">` handler — leave it as-is, it works independently.

However, ensure the upload button in `BankDashboard.tsx` respects Leo's existing styles. Find Leo's primary button style (likely a `<Button variant="primary">` component) and replace the raw `<button>` elements for "Upload Excel" with that component.

Example:
```tsx
// Before (raw button):
<button onClick={() => fileRef.current.click()} style={{ background:"#1D4ED8", ... }}>
  📂 Excel
</button>

// After (Leo's button component):
<Button variant="primary" size="sm" onClick={() => fileRef.current.click()}>
  📂 Upload Excel
</Button>
```

---

### STEP 8 — Add to bottom navigation (mobile)

Leo Planner has a bottom navigation bar for mobile. Find it (likely `src/components/BottomNav.tsx` or similar).

Do NOT add a new bottom nav item for Bank Records — it lives inside Safe. Instead, make sure tapping the 🔒 Safe nav item and then selecting "Bank Records" from the category list works correctly end-to-end on mobile.

Test the flow:
1. Tap 🔒 Safe in bottom nav
2. See category list including 🏦 Bank Records
3. Tap Bank Records → dashboard loads with data
4. Back button returns to Safe category list

---

### STEP 9 — TypeScript types

Add these types to `src/types/safe.ts` (or create `src/types/bankRecords.ts`):

```ts
export interface Deposit {
  bank: string
  type: string
  depositId: string
  nominee: string
  startDate: string
  deposit: number | ''
  roi: number | ''
  maturityAmt: number | ''
  maturityDate: string
  duration: string
  maturityAction: string
  done: boolean
}

export interface BankAccount {
  bank: string
  type: string
  holders: string
  amount: number | ''
  roi: number | ''
  online: string
  address: string
  detail: string
  nextAction: string
  done: boolean
}

export interface Bill {
  name: string
  freq: string
  amount: number | ''
  due: string
  priority: string
  phone: string
  email: string
  done: boolean
}

export interface ActionItem {
  title: string
  bank: string
  date: string
  note: string
  done: boolean
}

export interface BankRecordsData {
  deposits: Deposit[]
  accounts: BankAccount[]
  bills: Bill[]
  actions: ActionItem[]
}
```

---

### STEP 10 — Verify & test checklist

After making all changes, verify:

- [ ] `npm run dev` builds without TypeScript errors
- [ ] Safe section shows 🏦 Bank Records as a category option
- [ ] Clicking Bank Records loads the dashboard with pre-seeded data
- [ ] Charts render correctly (recharts loaded)
- [ ] Excel upload parses and populates data
- [ ] Editing/adding/deleting a deposit saves to Supabase
- [ ] Refreshing the page reloads data from Supabase (not re-seeding)
- [ ] On mobile, Safe → Bank Records navigation works
- [ ] `/safe/bank-records` deep link opens directly to dashboard
- [ ] No console errors related to BankDashboard

---

## FILES SUMMARY

| Action | File |
|--------|------|
| DROP IN (already done) | `src/components/safe/BankDashboard.tsx` |
| EDIT — add category type | `src/types/safe.ts` |
| EDIT — add category to list | `src/components/safe/SafeSection.tsx` |
| EDIT — render dashboard | `src/components/safe/SafeSection.tsx` |
| EDIT — add route | `src/App.tsx` |
| CREATE — Supabase table | Supabase SQL editor |
| EDIT — Supabase read/write | `src/components/safe/BankDashboard.tsx` |
| EDIT — theme matching | `src/components/safe/BankDashboard.tsx` |
| EDIT — button components | `src/components/safe/BankDashboard.tsx` |
| VERIFY — types | `src/types/bankRecords.ts` (new file) |

---

## IMPORTANT NOTES FOR CURSOR

- Do NOT rewrite `BankDashboard.tsx` from scratch — only make the targeted edits described above
- Do NOT change any existing Safe categories or their functionality
- Do NOT modify the dashboard's chart logic, data structure, or UI layout
- The `PRELOAD_DATA` constant inside `BankDashboard.tsx` already contains real seeded data — do not remove it
- If you are unsure about any existing file name or component name, scan the `src/` directory first before assuming
- Prefer surgical edits over rewrites — change only what is necessary
