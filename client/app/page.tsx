"use client";

import { FormEvent, useMemo, useState } from "react";

type ItemCategory = "lost" | "found";
type ItemStatus = "active" | "resolved";
type View = "home" | "browse" | "reports" | "notifications" | "account";
type AccountType = "student" | "staff";

type User = {
  username: string;
  email?: string;
  account_type: AccountType;
  identifier: string;
};

type Item = {
  id: string;
  title: string;
  description: string;
  category: ItemCategory;
  location: string;
  date_event: string;
  status: ItemStatus;
  reporter: string;
};

const initialItems: Item[] = [
  { id: "1", title: "Black iPhone 14", description: "Black iPhone with a clear case and a small university crest sticker on the back.", category: "lost", location: "Library, Level 2", date_event: "2026-09-10", status: "active", reporter: "Naledi" },
  { id: "2", title: "Student card", description: "Student card found near the engineering block.", category: "found", location: "Engineering block", date_event: "2026-09-16", status: "active", reporter: "Thando" },
  { id: "3", title: "Silver keys", description: "A small set of silver keys on a plain ring.", category: "found", location: "Main quad", date_event: "2026-09-15", status: "resolved", reporter: "Campus Security" },
  { id: "4", title: "Brown leather wallet", description: "Brown leather wallet with two cards inside.", category: "lost", location: "Student centre", date_event: "2026-09-12", status: "active", reporter: "Mpho" },
];

const categoryIcon: Record<string, string> = { lost: "↗", found: "⌕" };

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [items, setItems] = useState(initialItems);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState<ItemCategory>("lost");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ItemCategory>("all");
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesType = filter === "all" || item.category === filter;
    const query = search.toLowerCase();
    return matchesType && (!query || `${item.title} ${item.description} ${item.location}`.toLowerCase().includes(query));
  }), [filter, items, search]);

  function openReport(type: ItemCategory) {
    setReportType(type);
    setShowReport(true);
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const newItem: Item = {
      id: crypto.randomUUID(),
      title: String(data.get("title")),
      description: String(data.get("description")),
      category: reportType,
      location: String(data.get("location")),
      date_event: String(data.get("date_event")),
      status: "active",
      reporter: user?.username || "Unknown student",
    };
    setItems((current) => [newItem, ...current]);
    setShowReport(false);
    setView("reports");
  }

  function resolveItem(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status: "resolved" } : item));
    setSelectedItem((item) => item ? { ...item, status: "resolved" } : item);
  }

  async function login(accountType: AccountType, identifier: string, password: string) {
    setAuthError("");
    setAuthMessage("");
    try {
      const response = await fetch("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_type: accountType, identifier, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in");
      localStorage.setItem("campuslink_token", result.token);
      setUser(result.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to sign in");
    }
  }

  async function register(accountType: AccountType, name: string, surname: string, email: string, identifier: string, password: string) {
    setAuthError("");
    setAuthMessage("");
    const expectedEmail = `${identifier.trim().toLowerCase()}@tut4life.ac.za`;
    if (email.trim().toLowerCase() !== expectedEmail) {
      setAuthError(`Use ${expectedEmail} for this account.`);
      return;
    }
    try {
      const response = await fetch("http://localhost:3000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: `${name.trim()} ${surname.trim()}`,
          email,
          password,
          account_type: accountType,
          ...(accountType === "student" ? { student_number: identifier } : { staff_number: identifier }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create account");
        setAuthMessage("Account created. Sign in with your campus number and password.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to create account");
    }
  }

  if (!user) return <LoginPage onLogin={login} onRegister={register} error={authError} message={authMessage} />;
  if (user.account_type === "staff") return <SecurityDashboard user={user} items={items} onLogout={() => setUser(null)} onResolve={resolveItem} />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="Go to home"><span>UF</span><strong>Campus<span>Link</span></strong></button>
        <nav className="topnav" aria-label="Main navigation">
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>Home</button>
          <button className={view === "browse" ? "active" : ""} onClick={() => setView("browse")}>Browse items</button>
          <button className={view === "reports" ? "active" : ""} onClick={() => setView("reports")}>My reports</button>
          <button className={view === "notifications" ? "active" : ""} onClick={() => setView("notifications")}>Notifications <b>2</b></button>
        </nav>
        <button className="user-chip" onClick={() => setView("account")}><span>{getInitials(user.username)}</span><span className="user-name">{user.username}</span></button>
      </header>

      {view === "home" && <HomeView items={items} onBrowse={() => setView("browse")} onReport={openReport} onSelect={setSelectedItem} />}
      {view === "browse" && <BrowseView items={visibleItems} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} onSelect={setSelectedItem} onReport={openReport} />}
      {view === "reports" && <ReportsView items={items.filter((item) => item.reporter === user.username)} onSelect={setSelectedItem} onReport={openReport} />}
      {view === "notifications" && <NotificationsView />}
      {view === "account" && <AccountView user={user} items={items.filter((item) => item.reporter === user.username)} onBrowseReports={() => setView("reports")} />}

      <footer className="footer"><span>CampusLink</span><span>Lost and found, together.</span><button onClick={() => { localStorage.removeItem("campuslink_token"); setUser(null); }}>Sign out</button></footer>

      {showReport && <ReportModal type={reportType} onClose={() => setShowReport(false)} onSubmit={submitReport} />}
      {selectedItem && <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} onResolve={resolveItem} />}
    </main>
  );
}

function HomeView({ items, onBrowse, onReport, onSelect }: { items: Item[]; onBrowse: () => void; onReport: (type: ItemCategory) => void; onSelect: (item: Item) => void }) {
  return <>
    <section className="hero"><div><p className="eyebrow">CAMPUS LOST &amp; FOUND</p><h1>Find what matters.<br /><em>Return what doesn&apos;t.</em></h1><p className="hero-copy">A trusted board for reporting lost items, sharing found belongings, and getting them back to the right person.</p><div className="hero-actions"><button className="button dark" onClick={() => onReport("lost")}>Report lost item <span>→</span></button><button className="button gold" onClick={() => onReport("found")}>Report found item <span>+</span></button></div></div><div className="hero-note"><span>✦</span><p><strong>Built for campus.</strong><br />Every report helps our community look out for one another.</p></div></section>
    <section className="section"><div className="section-heading"><div><p className="eyebrow">LIVE BOARD</p><h2>Recent on campus</h2></div><button className="text-button" onClick={onBrowse}>View all <span>↗</span></button></div><div className="item-grid">{items.slice(0, 3).map((item) => <ItemCard key={item.id} item={item} onClick={() => onSelect(item)} />)}</div></section>
    <section className="stats"><div><strong>{items.filter((item) => item.status === "active").length}</strong><span>active reports</span></div><div><strong>{items.filter((item) => item.status === "resolved").length}</strong><span>items reunited</span></div><div><strong>24h</strong><span>average response</span></div></section>
  </>;
}

function BrowseView({ items, search, setSearch, filter, setFilter, onSelect, onReport }: { items: Item[]; search: string; setSearch: (value: string) => void; filter: "all" | ItemCategory; setFilter: (value: "all" | ItemCategory) => void; onSelect: (item: Item) => void; onReport: (type: ItemCategory) => void }) {
  return <section className="page-section"><div className="page-intro"><p className="eyebrow">THE BOARD</p><h1>Browse items</h1><p>Search reports from across campus and help bring something home.</p></div><div className="toolbar"><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item, place, or detail" /></label><div className="filters"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>All items</button><button className={filter === "lost" ? "selected" : ""} onClick={() => setFilter("lost")}>Lost</button><button className={filter === "found" ? "selected" : ""} onClick={() => setFilter("found")}>Found</button></div></div><div className="browse-layout"><div className="browse-list">{items.length ? items.map((item) => <ItemCard key={item.id} item={item} onClick={() => onSelect(item)} />) : <div className="empty-state"><span>⌕</span><h3>No matching reports</h3><p>Try a broader search or report the item yourself.</p></div>}</div><aside className="side-callout"><span className="callout-icon">+</span><h3>Have you found something?</h3><p>Small details can make a big difference. Add it to the board so its owner can find it.</p><button className="button gold" onClick={() => onReport("found")}>Report found item</button></aside></div></section>;
}

function ReportsView({ items, onSelect, onReport }: { items: Item[]; onSelect: (item: Item) => void; onReport: (type: ItemCategory) => void }) {
  return <section className="page-section"><div className="page-intro reports-intro"><div><p className="eyebrow">YOUR ACTIVITY</p><h1>My reports</h1><p>Keep track of the items you have reported.</p></div><button className="button dark" onClick={() => onReport("lost")}>New report <span>+</span></button></div><div className="report-summary"><div><strong>{items.filter((item) => item.status === "active").length}</strong><span>Active</span></div><div><strong>{items.filter((item) => item.status === "resolved").length}</strong><span>Resolved</span></div></div><div className="reports-list">{items.length ? items.map((item) => <ItemCard key={item.id} item={item} onClick={() => onSelect(item)} />) : <div className="empty-state"><h3>No reports yet</h3><p>Your lost or found reports will appear here.</p></div>}</div></section>;
}

function NotificationsView() { return <section className="page-section narrow"><div className="page-intro"><p className="eyebrow">STAY IN THE LOOP</p><h1>Notifications</h1><p>Updates about reports that may connect with yours.</p></div><div className="notifications"><Notice icon="✦" title="Match found" text="Your lost iPhone has been matched with a found item." time="12 min ago" highlight /><Notice icon="✓" title="Case resolved" text="Your silver keys have been collected. Case resolved." time="Yesterday" /><Notice icon="⌂" title="Ready for collection" text="A wallet matching your report is at Campus Security." time="2 days ago" /><Notice icon="i" title="Report update" text="Security reviewed your lost item report." time="3 days ago" /></div></section>; }

function AccountView({ user, items, onBrowseReports }: { user: User; items: Item[]; onBrowseReports: () => void }) {
  const activeItems = items.filter((item) => item.status === "active");
  const resolvedItems = items.filter((item) => item.status === "resolved");
  return <section className="page-section account-page"><div className="page-intro"><p className="eyebrow">YOUR ACCOUNT</p><h1>{user.username}</h1><p>Manage your campus profile and keep track of your lost and found activity.</p></div><div className="account-layout"><section className="account-profile"><span className="account-avatar">{getInitials(user.username)}</span><div><h2>Student profile</h2><p>{user.email || "Campus email not provided"}</p><span className="account-number">Student number: {user.identifier}</span></div></section><section className="account-panel"><div className="account-panel-heading"><div><p className="eyebrow">ACTIVE LISTINGS</p><h2>Your active reports</h2></div><strong>{activeItems.length}</strong></div>{activeItems.length ? <div className="account-list">{activeItems.map((item) => <ItemCard key={item.id} item={item} onClick={() => onBrowseReports()} />)}</div> : <p className="account-empty">You have no active listings.</p>}</section><section className="account-panel"><div className="account-panel-heading"><div><p className="eyebrow">CONTACT PREFERENCES</p><h2>How we reach you</h2></div><span className="preference-state">Enabled</span></div><div className="preference-row"><span>Email updates</span><strong>{user.email || "Campus email"}</strong></div><div className="preference-row"><span>Match alerts</span><strong>On</strong></div></section><section className="account-panel"><div className="account-panel-heading"><div><p className="eyebrow">RESOLUTION HISTORY</p><h2>Resolved reports</h2></div><strong>{resolvedItems.length}</strong></div>{resolvedItems.length ? <div className="account-list">{resolvedItems.map((item) => <ItemCard key={item.id} item={item} onClick={onBrowseReports} />)}</div> : <p className="account-empty">Resolved reports will appear here.</p>}</section></div></section>;
}

function Notice({ icon, title, text, time, highlight = false }: { icon: string; title: string; text: string; time: string; highlight?: boolean }) { return <article className={`notice ${highlight ? "highlight" : ""}`}><span className="notice-icon">{icon}</span><div><strong>{title}</strong><p>{text}</p><small>{time}</small></div>{highlight && <b className="unread" />}</article>; }

function ItemCard({ item, onClick }: { item: Item; onClick: () => void }) { return <button className="item-card" onClick={onClick}><span className="item-symbol">{categoryIcon[item.category]}</span><span className="item-content"><strong>{item.title}</strong><span>{item.location} <i>·</i> {formatDate(item.date_event)}</span></span><span className={`status ${item.status}`}>{item.status === "resolved" ? "Resolved" : item.category === "lost" ? "Lost" : "Found"}</span></button>; }

function ReportModal({ type, onClose, onSubmit }: { type: ItemCategory; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <div className="modal-backdrop"><form className="modal" onSubmit={onSubmit}><button type="button" className="close" onClick={onClose}>×</button><p className="eyebrow">NEW REPORT</p><h2>Report {type} item</h2><p className="modal-copy">Share a few details so the campus community can help.</p><label>Item name<input name="title" required placeholder={type === "lost" ? "e.g. Black iPhone 14" : "e.g. Brown leather wallet"} /></label><label>Description<textarea name="description" required placeholder="Include useful identifying details" /></label><label>{type === "lost" ? "Last seen location" : "Found at"}<input name="location" required placeholder="Building or area" /></label><label>Date {type === "lost" ? "lost" : "found"}<input name="date_event" type="date" required defaultValue="2026-09-17" /></label><label className="photo-input"><span>▣</span> Add an optional photo<input type="file" accept="image/*" /></label><button className={`button ${type === "lost" ? "dark" : "gold"}`} type="submit">Submit {type} item report <span>→</span></button></form></div>; }

function ItemModal({ item, onClose, onResolve }: { item: Item; onClose: () => void; onResolve: (id: string) => void }) { return <div className="modal-backdrop"><div className="modal detail-modal"><button className="close" onClick={onClose}>×</button><div className="detail-image">{categoryIcon[item.category]}</div><span className={`status ${item.status}`}>{item.status === "resolved" ? "Resolved" : item.category === "lost" ? "Lost" : "Found"}</span><h2>{item.title}</h2><p className="detail-category">{item.category === "lost" ? "Lost item" : "Found item"} · Reported by {item.reporter}</p><p>{item.description}</p><div className="detail-meta"><span>⌖ <b>Location</b> {item.location}</span><span>▣ <b>Date</b> {formatDate(item.date_event)}</span></div><p className="privacy-note">Bring your student card and proof of ownership to Campus Security.</p>{item.status === "active" && <button className="button dark" onClick={() => onResolve(item.id)}>Mark as resolved</button>}</div></div>; }

function LoginPage({ onLogin, onRegister, error, message }: { onLogin: (accountType: AccountType, identifier: string, password: string) => Promise<void>; onRegister: (accountType: AccountType, name: string, surname: string, email: string, identifier: string, password: string) => Promise<void>; error: string; message: string }) {
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    if (mode === "login") {
      await onLogin(accountType, identifier, password);
    } else {
      await onRegister(accountType, name, surname, email, identifier, password);
      setMode("login");
    }
    setBusy(false);
  }

  const isRegistering = mode === "register";
  const emailPlaceholder = accountType === "student" ? "202312345@tut4life.ac.za" : "SEC-001@tut4life.ac.za";
  return <main className="login-shell"><div className="login-art"><button className="brand" aria-label="CampusLink"><span>UF</span><strong>Campus<span>Link</span></strong></button><div><p className="eyebrow">CAMPUS LOST &amp; FOUND</p><h1>Find what matters.<br /><em>Return what doesn&apos;t.</em></h1><p>A trusted board for the campus community.</p></div><small>Lost and found, together.</small></div><section className="login-panel"><div className="login-heading"><p className="eyebrow">{isRegistering ? "JOIN CAMPUSLINK" : "WELCOME BACK"}</p><h2>{isRegistering ? "Create your account" : "Sign in to CampusLink"}</h2><p>{isRegistering ? "Use your campus details to join the board." : "Use your campus credentials to continue."}</p></div><div className="account-switch"><button type="button" className={accountType === "student" ? "selected" : ""} onClick={() => setAccountType("student")}>Student</button><button type="button" className={accountType === "staff" ? "selected" : ""} onClick={() => setAccountType("staff")}>Campus Security</button></div><form onSubmit={submit} className="login-form">{isRegistering && <div className="name-fields"><label>Name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="First name" autoComplete="given-name" /></label><label>Surname<input required value={surname} onChange={(event) => setSurname(event.target.value)} placeholder="Surname" autoComplete="family-name" /></label></div>}{isRegistering && <label>{accountType === "student" ? "Student email" : "Staff email"}<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={accountType === "student" ? "you@student.campus.edu" : "you@campus.edu"} autoComplete="email" /></label>}<label>{accountType === "student" ? "Student number" : "Staff number"}<input required value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={accountType === "student" ? "e.g. 202312345" : "e.g. SEC-001"} autoComplete="username" /></label><label>Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete={isRegistering ? "new-password" : "current-password"} /></label>{error && <p className="form-error">{error}</p>}{message && !isRegistering && <p className="form-success">{message}</p>}<button className="button dark" type="submit" disabled={busy}>{busy ? (isRegistering ? "Creating account..." : "Signing in...") : (isRegistering ? "Create account" : "Sign in")}<span>→</span></button></form><button className="switch-auth" type="button" onClick={() => { setMode(isRegistering ? "login" : "register"); }}>{isRegistering ? "Already have an account? Sign in" : "New to CampusLink? Create an account"}</button></section></main>;
}

function SecurityDashboard({ user, items, onLogout, onResolve }: { user: User; items: Item[]; onLogout: () => void; onResolve: (id: string) => void }) {
  const activeItems = items.filter((item) => item.status === "active");
  return <main className="security-shell"><header className="security-header"><div><p className="eyebrow">CAMPUS SECURITY</p><h1>Good morning, {user.username}</h1><p>Custody and collection overview</p></div><div className="security-actions"><span className="security-avatar">{getInitials(user.username)}</span><button onClick={onLogout}>Sign out</button></div></header><section className="security-content"><div className="security-stats"><div><strong>{activeItems.length}</strong><span>In custody</span></div><div><strong>{items.filter((item) => item.category === "lost" && item.status === "active").length}</strong><span>Awaiting matches</span></div><div><strong>{items.filter((item) => item.status === "resolved").length}</strong><span>Resolved</span></div></div><div className="security-title"><div><p className="eyebrow">TODAY&apos;S WORK QUEUE</p><h2>Manage items</h2></div><button className="button gold">+ Log found item</button></div><div className="security-layout"><div className="custody-list">{activeItems.map((item) => <article className="custody-card" key={item.id}><span className="item-symbol">{categoryIcon[item.category]}</span><div><strong>{item.title}</strong><p>{item.location} · Received {formatDate(item.date_event)}</p><span className="status active">Awaiting collection</span></div><button onClick={() => onResolve(item.id)}>Release item</button></article>)}</div><aside className="security-note"><span>✓</span><h3>Release checklist</h3><p>Verify student ID, proof of ownership, and item condition before releasing an item.</p><button className="text-button">View protocol ↗</button></aside></div></section></main>;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDate(date: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`)); }
