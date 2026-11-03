import { useEffect, useMemo, useState } from 'react'

const USERS_KEY = 'budgetflow_users_v1'
const SESSION_KEY = 'budgetflow_session_v1'
const TX_KEY = 'budgetflow_transactions_v1'
const BUDGET_KEY = 'budgetflow_budget_v1'
const GOAL_KEY = 'budgetflow_goal_v1'

const ADMIN = { id: 'admin-1', name: 'BudgetFlow Admin', email: 'admin@budgetflow.com', password: 'Admin@123', role: 'admin' }

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)) }
function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0)
}
function dateToday() { return new Date().toISOString().slice(0, 10) }

export default function App() {
  const [users, setUsers] = useState(() => {
    const saved = read(USERS_KEY, [])
    return saved.some(u => u.email === ADMIN.email) ? saved : [ADMIN, ...saved]
  })
  const [session, setSession] = useState(() => read(SESSION_KEY, null))
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [section, setSection] = useState('dashboard')
  const [transactions, setTransactions] = useState(() => read(TX_KEY, []))
  const [budget, setBudget] = useState(() => read(BUDGET_KEY, 20000))
  const [goal, setGoal] = useState(() => read(GOAL_KEY, { name: 'Emergency Fund', target: 80000 }))
  const [dark, setDark] = useState(() => read('budgetflow_dark_v1', false))
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ type: 'expense', amount: '', category: 'Food', description: '', date: dateToday() })
  const [budgetInput, setBudgetInput] = useState(String(budget))
  const [goalInput, setGoalInput] = useState({ name: goal.name, target: String(goal.target) })
  const [notice, setNotice] = useState('')

  useEffect(() => write(USERS_KEY, users), [users])
  useEffect(() => write(TX_KEY, transactions), [transactions])
  useEffect(() => write(BUDGET_KEY, budget), [budget])
  useEffect(() => write(GOAL_KEY, goal), [goal])
  useEffect(() => write('budgetflow_dark_v1', dark), [dark])
  useEffect(() => write(SESSION_KEY, session), [session])

  const isAdmin = session?.role === 'admin'
  const myTransactions = useMemo(
    () => transactions.filter(t => t.userId === session?.id),
    [transactions, session]
  )
  const totals = useMemo(() => {
    const income = myTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0)
    const expense = myTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0)
    return { income, expense, balance: income - expense, savingRate: income > 0 ? Math.round(((income - expense) / income) * 100) : 0 }
  }, [myTransactions])
  const categoryTotals = useMemo(() => {
    const map = {}
    myTransactions.filter(t => t.type === 'expense').forEach(t => { map[t.category] = (map[t.category] || 0) + Number(t.amount) })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [myTransactions])
  const filteredTransactions = useMemo(() => myTransactions.filter(t => {
    const matches = `${t.description} ${t.category}`.toLowerCase().includes(search.toLowerCase())
    return matches && (filter === 'all' || t.type === filter)
  }), [myTransactions, search, filter])
  const allUserTransactions = useMemo(() => transactions, [transactions])

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  function handleAuth(event) {
    event.preventDefault()
    setAuthError('')
    const email = authForm.email.trim().toLowerCase()
    if (!email || !authForm.password) return setAuthError('Enter your email and password.')
    if (authMode === 'signup') {
      if (!authForm.name.trim()) return setAuthError('Please enter your name.')
      if (authForm.password.length < 6) return setAuthError('Password must contain at least 6 characters.')
      if (users.some(u => u.email.toLowerCase() === email)) return setAuthError('An account with this email already exists.')
      const newUser = { id: crypto.randomUUID(), name: authForm.name.trim(), email, password: authForm.password, role: 'user' }
      setUsers(prev => [...prev, newUser])
      setSession({ id: newUser.id, name: newUser.name, email: newUser.email, role: 'user' })
      setSection('dashboard')
      setAuthForm({ name: '', email: '', password: '' })
      return
    }
    const user = users.find(u => u.email.toLowerCase() === email && u.password === authForm.password)
    if (!user) return setAuthError('Incorrect email or password.')
    setSession({ id: user.id, name: user.name, email: user.email, role: user.role })
    setSection(user.role === 'admin' ? 'admin' : 'dashboard')
    setAuthForm({ name: '', email: '', password: '' })
  }

  function logout() {
    setSession(null)
    setSection('dashboard')
    setAuthMode('login')
  }

  function openAdd() {
    setEditing(null)
    setForm({ type: 'expense', amount: '', category: 'Food', description: '', date: dateToday() })
    setShowModal(true)
  }
  function openEdit(tx) {
    setEditing(tx.id)
    setForm({ type: tx.type, amount: String(tx.amount), category: tx.category, description: tx.description, date: tx.date })
    setShowModal(true)
  }
  function saveTransaction(event) {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!amount || amount <= 0) return showNotice('Enter a valid amount.')
    const item = { id: editing || crypto.randomUUID(), userId: session.id, type: form.type, amount, category: form.category, description: form.description.trim() || form.category, date: form.date }
    setTransactions(prev => editing ? prev.map(t => t.id === editing ? item : t) : [item, ...prev])
    setShowModal(false)
    showNotice(editing ? 'Transaction updated.' : 'Transaction added.')
  }
  function deleteTransaction(id) {
    if (window.confirm('Delete this transaction?')) {
      setTransactions(prev => prev.filter(t => t.id !== id))
      showNotice('Transaction deleted.')
    }
  }
  function saveBudget(event) {
    event.preventDefault()
    const value = Number(budgetInput)
    if (!value || value <= 0) return showNotice('Enter a valid monthly budget.')
    setBudget(value)
    showNotice('Monthly budget updated.')
  }
  function saveGoal(event) {
    event.preventDefault()
    const target = Number(goalInput.target)
    if (!goalInput.name.trim() || !target || target <= 0) return showNotice('Enter a valid savings goal.')
    setGoal({ name: goalInput.name.trim(), target })
    showNotice('Savings goal updated.')
  }
  function removeUser(id) {
    if (id === ADMIN.id) return showNotice('The main administrator cannot be removed.')
    if (!window.confirm('Remove this user and their transactions?')) return
    setUsers(prev => prev.filter(u => u.id !== id))
    setTransactions(prev => prev.filter(t => t.userId !== id))
    showNotice('User removed.')
  }

  if (!session) {
    return <div className={`auth-page ${dark ? 'dark' : ''}`}>
      <div className="auth-visual">
        <div className="brand"><span className="brand-mark">₹</span> BudgetFlow</div>
        <div className="auth-copy">
          <span className="eyebrow">PERSONAL FINANCE, MADE SIMPLE</span>
          <h1>Make every rupee<br /><em>work for you.</em></h1>
          <p>Understand your spending, build healthy money habits, and move closer to your financial goals.</p>
          <div className="auth-points"><span>✓ Track income & expenses</span><span>✓ Plan your monthly budget</span><span>✓ Monitor your savings goals</span></div>
        </div>
        <div className="auth-foot">Your money. Your plan. Your progress.</div>
      </div>
      <div className="auth-panel">
        <form className="auth-card" onSubmit={handleAuth}>
          <div className="mobile-brand"><span className="brand-mark">₹</span> BudgetFlow</div>
          <span className="eyebrow">{authMode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</span>
          <h2>{authMode === 'login' ? 'Sign in to your account' : 'Create your account'}</h2>
          <p className="muted">{authMode === 'login' ? 'Enter your details to continue to your dashboard.' : 'Start organizing your finances in one place.'}</p>
          {authMode === 'signup' && <label>Full name<input value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Your name" /></label>}
          <label>Email address<input type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" /></label>
          <label>Password<input type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 6 characters" /></label>
          {authError && <div className="error">{authError}</div>}
          <button className="primary-btn full" type="submit">{authMode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button>
          <div className="auth-switch">{authMode === 'login' ? "Don't have an account?" : 'Already have an account?'} <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError('') }}>{authMode === 'login' ? 'Sign up' : 'Sign in'}</button></div>
          <div className="demo-box"><strong>Demo administrator</strong><span>Email: admin@budgetflow.com</span><span>Password: Admin@123</span></div>
        </form>
      </div>
    </div>
  }

  const nav = isAdmin
    ? [{ id: 'admin', icon: '▦', label: 'Overview' }, { id: 'users', icon: '♙', label: 'Manage users' }, { id: 'admin-transactions', icon: '↗', label: 'All transactions' }]
    : [{ id: 'dashboard', icon: '▦', label: 'Dashboard' }, { id: 'transactions', icon: '↔', label: 'Transactions' }, { id: 'analytics', icon: '◔', label: 'Analytics' }, { id: 'goals', icon: '◎', label: 'Savings goals' }, { id: 'settings', icon: '⚙', label: 'Settings' }]
  const pageTitle = ({ dashboard: 'Dashboard', transactions: 'Transactions', analytics: 'Analytics', goals: 'Savings goals', settings: 'Settings', admin: 'Admin overview', users: 'Manage users', 'admin-transactions': 'All transactions' })[section] || 'Dashboard'
  const pageSubtitle = isAdmin ? 'Monitor users and activity across BudgetFlow.' : 'Here is your personal financial overview.'
  const userCount = users.filter(u => u.role === 'user').length
  const totalPlatformTransactions = allUserTransactions.length
  const spentPercent = budget > 0 ? Math.min((totals.expense / budget) * 100, 100) : 0
  const goalPercent = goal.target > 0 ? Math.min(Math.max(totals.balance, 0) / goal.target * 100, 100) : 0

  return <div className={`app-shell ${dark ? 'dark' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">₹</span><span>BudgetFlow</span></div>
      <div className="side-label">{isAdmin ? 'ADMINISTRATION' : 'WORKSPACE'}</div>
      <nav>{nav.map(item => <button key={item.id} className={`nav-item ${section === item.id ? 'selected' : ''}`} onClick={() => setSection(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="profile"><div className="avatar">{session.name?.[0]?.toUpperCase() || 'U'}</div><div className="profile-info"><strong>{session.name}</strong><small>{isAdmin ? 'Administrator' : 'Personal account'}</small></div></div>
        <button className="logout-btn" onClick={logout}>↪ <span>Log out</span></button>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><div className="breadcrumb">BUDGETFLOW <span>/</span> {pageTitle.toUpperCase()}</div><h1>{pageTitle}</h1><p>{pageSubtitle}</p></div><div className="topbar-right"><button className="theme-btn" onClick={() => setDark(v => !v)} title="Toggle theme">{dark ? '☀' : '◐'}</button><div className="top-user"><div className="avatar small">{session.name?.[0]?.toUpperCase()}</div><div><strong>{session.name}</strong><small>{isAdmin ? 'Admin' : 'User'}</small></div></div></div></header>

      {section === 'dashboard' && !isAdmin && <div className="page-content">
        <div className="welcome-banner"><div><span className="eyebrow">YOUR FINANCIAL SNAPSHOT</span><h2>Welcome back, {session.name.split(' ')[0]} 👋</h2><p>A little awareness today can make a big difference tomorrow.</p></div><button className="primary-btn" onClick={openAdd}>＋ Add transaction</button></div>
        <div className="stats-grid">
          <Stat title="Total income" value={money(totals.income)} note="Money received" icon="↗" tone="green" />
          <Stat title="Total expenses" value={money(totals.expense)} note="Money spent" icon="↘" tone="red" />
          <Stat title="Available balance" value={money(totals.balance)} note="Income minus expenses" icon="₹" tone="blue" />
          <Stat title="Savings rate" value={`${totals.savingRate}%`} note="Of your total income" icon="％" tone="purple" />
        </div>
        <div className="two-column">
          <div className="panel"><div className="panel-head"><div><h3>Spending by category</h3><p>Where your money is going</p></div><span className="pill">ALL TIME</span></div>
            {categoryTotals.length ? <div className="category-list">{categoryTotals.map(([name, value], i) => <div className="category-row" key={name}><div className="category-top"><span>{name}</span><strong>{money(value)}</strong></div><div className="track"><div className={`bar bar-${i % 5}`} style={{ width: `${totals.expense ? value / totals.expense * 100 : 0}%` }} /></div></div>)}</div> : <Empty title="No spending data yet" text="Add an expense to see your category breakdown." />}
          </div>
          <div className="panel"><div className="panel-head"><div><h3>Monthly budget</h3><p>Keep your spending on track</p></div><span className="budget-icon">₹</span></div><div className="budget-big">{money(totals.expense)}<small> / {money(budget)}</small></div><div className="track thick"><div className="bar bar-green" style={{ width: `${spentPercent}%` }} /></div><div className="budget-meta"><span>{Math.round(spentPercent)}% used</span><strong>{money(budget - totals.expense)} {budget >= totals.expense ? 'left' : 'over'}</strong></div>{spentPercent >= 80 && <div className="warning">⚠ {spentPercent >= 100 ? 'You have reached or exceeded your budget.' : 'You have used more than 80% of your budget.'}</div>}<button className="secondary-btn full" onClick={() => setSection('settings')}>Manage budget</button></div>
        </div>
        <div className="two-column bottom-row">
          <div className="panel"><div className="panel-head"><div><h3>Recent transactions</h3><p>Your latest financial activity</p></div><button className="link-btn" onClick={() => setSection('transactions')}>View all →</button></div><TransactionList items={myTransactions.slice(0, 5)} onEdit={openEdit} onDelete={deleteTransaction} /></div>
          <div className="panel"><div className="panel-head"><div><h3>{goal.name}</h3><p>Your savings goal</p></div><span className="goal-emoji">◎</span></div><div className="goal-number">{money(Math.max(totals.balance, 0))}<small> saved</small></div><div className="track thick"><div className="bar bar-blue" style={{ width: `${goalPercent}%` }} /></div><div className="budget-meta"><span>{Math.round(goalPercent)}% completed</span><strong>{money(goal.target)} target</strong></div><button className="secondary-btn full" onClick={() => setSection('goals')}>View savings goal</button></div>
        </div>
      </div>}

      {section === 'transactions' && !isAdmin && <div className="page-content"><div className="section-title"><div><h2>All transactions</h2><p>Review and manage your income and expenses.</p></div><button className="primary-btn" onClick={openAdd}>＋ Add transaction</button></div><div className="panel"><div className="toolbar"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by description or category..." /><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select></div><TransactionList items={filteredTransactions} onEdit={openEdit} onDelete={deleteTransaction} /></div></div>}

      {section === 'analytics' && !isAdmin && <div className="page-content"><div className="section-title"><div><h2>Your analytics</h2><p>A simple breakdown of your financial activity.</p></div></div><div className="stats-grid"><Stat title="Income" value={money(totals.income)} icon="↗" tone="green" /><Stat title="Expenses" value={money(totals.expense)} icon="↘" tone="red" /><Stat title="Balance" value={money(totals.balance)} icon="₹" tone="blue" /><Stat title="Savings rate" value={`${totals.savingRate}%`} icon="％" tone="purple" /></div><div className="panel"><div className="panel-head"><div><h3>Expense distribution</h3><p>Category-wise spending totals</p></div></div>{categoryTotals.length ? <div className="category-list analytics-list">{categoryTotals.map(([name, value], i) => <div className="category-row" key={name}><div className="category-top"><span>{name}</span><strong>{money(value)} · {totals.expense ? Math.round(value / totals.expense * 100) : 0}%</strong></div><div className="track"><div className={`bar bar-${i % 5}`} style={{ width: `${totals.expense ? value / totals.expense * 100 : 0}%` }} /></div></div>)}</div> : <Empty title="Nothing to analyze yet" text="Your expense analytics will appear after you add transactions." />}</div></div>}

      {section === 'goals' && !isAdmin && <div className="page-content"><div className="section-title"><div><h2>Savings goals</h2><p>Set a target and keep moving towards it.</p></div></div><div className="panel goal-panel"><div className="goal-large-icon">◎</div><div className="goal-details"><span className="eyebrow">YOUR CURRENT GOAL</span><h2>{goal.name}</h2><p>Track your progress using your available balance.</p><div className="goal-number">{money(Math.max(totals.balance, 0))}<small> of {money(goal.target)}</small></div><div className="track thick"><div className="bar bar-blue" style={{ width: `${goalPercent}%` }} /></div><div className="budget-meta"><span>{Math.round(goalPercent)}% completed</span><strong>{money(Math.max(goal.target - Math.max(totals.balance, 0), 0))} to go</strong></div></div></div><div className="panel form-panel"><h3>Edit savings goal</h3><form onSubmit={saveGoal} className="inline-form"><label>Goal name<input value={goalInput.name} onChange={e => setGoalInput({ ...goalInput, name: e.target.value })} /></label><label>Target amount (₹)<input type="number" min="1" value={goalInput.target} onChange={e => setGoalInput({ ...goalInput, target: e.target.value })} /></label><button className="primary-btn">Save goal</button></form></div></div>}

      {section === 'settings' && !isAdmin && <div className="page-content"><div className="section-title"><div><h2>Settings</h2><p>Customize your BudgetFlow workspace.</p></div></div><div className="panel form-panel"><h3>Monthly budget</h3><p className="muted">Set the maximum amount you plan to spend each month.</p><form onSubmit={saveBudget} className="inline-form"><label>Monthly budget (₹)<input type="number" min="1" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} /></label><button className="primary-btn">Save budget</button></form><div className="settings-divider" /><h3>Appearance</h3><p className="muted">Choose the theme that feels comfortable.</p><button className="secondary-btn" onClick={() => setDark(v => !v)}>{dark ? 'Switch to light mode' : 'Switch to dark mode'}</button><div className="settings-divider" /><h3>Account details</h3><div className="account-line"><span>Name</span><strong>{session.name}</strong></div><div className="account-line"><span>Email</span><strong>{session.email}</strong></div><div className="account-line"><span>Account type</span><strong>Standard user</strong></div></div></div>}

      {section === 'admin' && isAdmin && <div className="page-content"><div className="welcome-banner admin-banner"><div><span className="eyebrow">ADMIN CONTROL CENTER</span><h2>Welcome, Administrator</h2><p>Review registered accounts and application activity.</p></div><span className="admin-symbol">♙</span></div><div className="stats-grid"><Stat title="Registered users" value={userCount} note="Standard accounts" icon="♙" tone="blue" /><Stat title="Transactions" value={totalPlatformTransactions} note="Across all accounts" icon="↗" tone="green" /><Stat title="Total income recorded" value={money(transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0))} icon="₹" tone="purple" /><Stat title="Total expenses recorded" value={money(transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0))} icon="↘" tone="red" /></div><div className="panel"><div className="panel-head"><div><h3>Recently registered users</h3><p>Accounts created in BudgetFlow</p></div><button className="link-btn" onClick={() => setSection('users')}>Manage users →</button></div><UserTable users={users.filter(u => u.role === 'user').slice(-5).reverse()} onRemove={removeUser} /></div></div>}

      {section === 'users' && isAdmin && <div className="page-content"><div className="section-title"><div><h2>Manage users</h2><p>View registered accounts and remove accounts when needed.</p></div><span className="pill">{userCount} USERS</span></div><div className="panel"><UserTable users={users.filter(u => u.role === 'user')} onRemove={removeUser} /></div></div>}

      {section === 'admin-transactions' && isAdmin && <div className="page-content"><div className="section-title"><div><h2>All transactions</h2><p>Transactions recorded by all registered users.</p></div></div><div className="panel"><div className="table-wrap"><table><thead><tr><th>DESCRIPTION</th><th>USER</th><th>CATEGORY</th><th>DATE</th><th>TYPE</th><th>AMOUNT</th></tr></thead><tbody>{transactions.length ? transactions.map(t => <tr key={t.id}><td>{t.description}</td><td>{users.find(u => u.id === t.userId)?.name || 'Deleted user'}</td><td>{t.category}</td><td>{t.date}</td><td><span className={`type-tag ${t.type}`}>{t.type}</span></td><td className={t.type === 'income' ? 'positive' : 'negative'}>{money(t.amount)}</td></tr>) : <tr><td colSpan="6" className="empty-cell">No transactions have been recorded.</td></tr>}</tbody></table></div></div></div>}
    </main>

    {showModal && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowModal(false)}><form className="modal-card" onSubmit={saveTransaction}><div className="modal-head"><div><span className="eyebrow">MONEY ACTIVITY</span><h2>{editing ? 'Edit transaction' : 'Add transaction'}</h2></div><button type="button" className="close-btn" onClick={() => setShowModal(false)}>×</button></div><div className="type-switch"><button type="button" className={form.type === 'expense' ? 'active expense-choice' : ''} onClick={() => setForm({ ...form, type: 'expense' })}>Expense</button><button type="button" className={form.type === 'income' ? 'active income-choice' : ''} onClick={() => setForm({ ...form, type: 'income' })}>Income</button></div><label>Amount (₹)<input autoFocus type="number" min="1" step="1" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="Enter amount" /></label><label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{(form.type === 'income' ? ['Salary', 'Freelance', 'Business', 'Gift', 'Other'] : ['Food', 'Transport', 'Shopping', 'Groceries', 'Travel', 'Education', 'Bills', 'Loan', 'Entertainment', 'Health', 'Other']).map(c => <option key={c}>{c}</option>)}</select></label><label>Description<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Monthly salary or college lunch" /></label><label>Date<input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label><button className="primary-btn full modal-submit">{editing ? 'Save changes' : 'Add transaction'}</button></form></div>}
    {notice && <div className="toast">{notice}</div>}
  </div>
}

function Stat({ title, value, note, icon, tone }) {
  return <div className="stat-card"><div className="stat-head"><span>{title}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong className="stat-value">{value}</strong>{note && <small>{note}</small>}</div>
}
function Empty({ title, text }) { return <div className="empty-state"><div className="empty-icon">↗</div><strong>{title}</strong><p>{text}</p></div> }
function TransactionList({ items, onEdit, onDelete }) {
  if (!items.length) return <Empty title="No transactions yet" text="Add your first income or expense to get started." />
  return <div className="transaction-list">{items.map(t => <div className="transaction-item" key={t.id}><div className={`transaction-symbol ${t.type}`}>{t.type === 'income' ? '↗' : '↘'}</div><div className="transaction-description"><strong>{t.description}</strong><small>{t.category} · {t.date}</small></div><div className="transaction-value"><strong className={t.type === 'income' ? 'positive' : 'negative'}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</strong><div className="row-actions"><button onClick={() => onEdit(t)}>Edit</button><button onClick={() => onDelete(t.id)}>Delete</button></div></div></div>)}</div>
}
function UserTable({ users, onRemove }) {
  if (!users.length) return <Empty title="No registered users" text="New user accounts will appear here after signup." />
  return <div className="table-wrap"><table><thead><tr><th>USER</th><th>EMAIL</th><th>ROLE</th><th>ACCOUNT ID</th><th>ACTION</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td><div className="table-user"><span className="avatar tiny">{u.name?.[0]?.toUpperCase()}</span><strong>{u.name}</strong></div></td><td>{u.email}</td><td><span className="type-tag user">User</span></td><td className="id-cell">{u.id.slice(0, 12)}</td><td><button className="danger-link" onClick={() => onRemove(u.id)}>Remove</button></td></tr>)}</tbody></table></div>
}
