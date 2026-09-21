"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ItemCategory = "lost" | "found";
type ItemStatus = "active" | "resolved";
type View = "home" | "browse" | "reports" | "notifications" | "account";
type AccountType = "student" | "staff";

type User = {
  id?: string;
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
  user_id?: string;
  reporter?: string;
};

type ContactPreferences = {
  emailUpdates: boolean;
  matchAlerts: boolean;
};

type NotificationItem = {
  id: string;
  title: string;
  text: string;
  time: string;
  highlight: boolean;
};

type ApiItem = {
  id: string;
  title: string;
  description: string;
  category: ItemCategory;
  location: string;
  date_event: string;
  status: ItemStatus;
  user_id?: string;
};

const API_BASE = "http://localhost:3000/api/v1";
const categoryIcon: Record<string, string> = { lost: "↗", found: "⌕" };
const defaultContactPreferences: ContactPreferences = { emailUpdates: true, matchAlerts: true };

function getStoredToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("campuslink_token") || "";
}

function getStoredContactPreferences(): ContactPreferences {
  if (typeof window === "undefined") return defaultContactPreferences;
  try {
    const saved = localStorage.getItem("campuslink_contact_preferences");
    return saved ? { ...defaultContactPreferences, ...JSON.parse(saved) } : defaultContactPreferences;
  } catch {
    return defaultContactPreferences;
  }
}

function getStoredNotifications(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("campuslink_notifications");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({ error: "Request failed" }));
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : typeof data?.message === "string" ? data.message : "Request failed";
    throw new Error(message);
  }

  return data as T;
}

function mapApiItem(item: ApiItem): Item {
  return {
    ...item,
    reporter: item.user_id || "Campus user",
  };
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState<ItemCategory>("lost");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ItemCategory>("all");
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [contactPreferences, setContactPreferences] = useState<ContactPreferences>(defaultContactPreferences);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [protocolOpen, setProtocolOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("campuslink_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setContactPreferences(getStoredContactPreferences());
    setNotifications(getStoredNotifications());
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadItems = async () => {
      setItemsLoading(true);
      setItemsError("");
      try {
        const data = await apiRequest<ApiItem[]>("/items");
        setItems(data.map(mapApiItem));
      } catch (error) {
        setItemsError(error instanceof Error ? error.message : "Unable to load items");
      } finally {
        setItemsLoading(false);
      }
    };

    void loadItems();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const latestNotifications: NotificationItem[] = [
      ...items.filter((item) => item.user_id === user.id && item.status === "resolved").slice(0, 2).map((item) => ({
        id: item.id,
        title: "Case resolved",
        text: `${item.title} has been resolved and is ready for your records.`,
        time: "Today",
        highlight: false,
      })),
      ...items.filter((item) => item.category === "found" && item.status === "active").slice(0, 2).map((item) => ({
        id: item.id,
        title: "New match available",
        text: `A found item matching campus activity may be relevant to your recent report: ${item.title}.`,
        time: "Recent",
        highlight: true,
      })),
    ];

    if (latestNotifications.length) {
      setNotifications(latestNotifications);
      localStorage.setItem("campuslink_notifications", JSON.stringify(latestNotifications));
    }
  }, [items, user]);

  useEffect(() => {
    localStorage.setItem("campuslink_contact_preferences", JSON.stringify(contactPreferences));
  }, [contactPreferences]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesType = filter === "all" || item.category === filter;
    const query = search.toLowerCase();
    return matchesType && (!query || `${item.title} ${item.description} ${item.location}`.toLowerCase().includes(query));
  }), [filter, items, search]);

  function openReport(type: ItemCategory) {
    setReportType(type);
    setShowReport(true);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    try {
      const item = await apiRequest<ApiItem>("/items", {
        method: "POST",
        body: JSON.stringify({
          title: String(data.get("title")),
          description: String(data.get("description")),
          category: reportType,
          location: String(data.get("location")),
          date_event: String(data.get("date_event")),
        }),
      });

      setItems((current) => [mapApiItem(item), ...current]);
      setShowReport(false);
      setView("reports");
    } catch (error) {
      setItemsError(error instanceof Error ? error.message : "Unable to create the report");
    }
  }

  async function resolveItem(id: string) {
    try {
      const item = await apiRequest<ApiItem>(`/items/${id}/resolve`, { method: "PATCH" });
      setItems((current) => current.map((entry) => entry.id === id ? mapApiItem(item) : entry));
      setSelectedItem((current) => current && current.id === id ? mapApiItem(item) : current);
    } catch (error) {
      setItemsError(error instanceof Error ? error.message : "Unable to resolve the item");
    }
  }

  async function login(accountType: AccountType, identifier: string, password: string) {
    setAuthError("");
    setAuthMessage("");
    try {
      const result = await apiRequest<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ account_type: accountType, identifier, password }),
      });
      const nextUser = { ...result.user, identifier };
      localStorage.setItem("campuslink_token", result.token);
      localStorage.setItem("campuslink_user", JSON.stringify(nextUser));
      setUser(nextUser);
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
      await apiRequest<{ message: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: `${name.trim()} ${surname.trim()}`,
          email,
          password,
          account_type: accountType,
          ...(accountType === "student" ? { student_number: identifier } : { staff_number: identifier }),
        }),
      });
      setAuthMessage("Account created. Sign in with your campus number and password.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to create account");
    }
  }

  function logout() {
    localStorage.removeItem("campuslink_token");
    localStorage.removeItem("campuslink_user");
    setUser(null);
    setItems([]);
    setSelectedItem(null);
    setView("home");
  }

  if (!user) return <LoginPage onLogin={login} onRegister={register} error={authError} message={authMessage} />;
  if (user.account_type === "staff") {
    return (
      <SecurityDashboard
        user={user}
        items={items}
        onLogout={logout}
        onResolve={resolveItem}
        onLogFound={() => openReport("found")}
        onViewProtocol={() => setProtocolOpen(true)}
      />
    );
  }

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

      {itemsError && <div className="error-banner">{itemsError}</div>}
      {itemsLoading && <div className="loading-banner">Loading items…</div>}

      {view === "home" && <HomeView items={items} onBrowse={() => setView("browse")} onReport={openReport} onSelect={setSelectedItem} />}
      {view === "browse" && <BrowseView items={visibleItems} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} onSelect={setSelectedItem} onReport={openReport} />}
      {view === "reports" && <ReportsView items={items.filter((item) => item.user_id === user.id)} onSelect={setSelectedItem} onReport={openReport} />}
      {view === "notifications" && <NotificationsView notifications={notifications} />}
      {view === "account" && <AccountView user={user} items={items.filter((item) => item.user_id === user.id)} contactPreferences={contactPreferences} setContactPreferences={setContactPreferences} onBrowseReports={() => setView("reports")} />}

      <footer className="footer"><span>CampusLink</span><span>Lost and found, together.</span><button onClick={logout}>Sign out</button></footer>

      {showReport && <ReportModal type={reportType} onClose={() => setShowReport(false)} onSubmit={submitReport} />}
      {selectedItem && <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} onResolve={resolveItem} />}
      {protocolOpen && <ProtocolModal onClose={() => setProtocolOpen(false)} />}
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

function NotificationsView({ notifications }: { notifications: NotificationItem[] }) {
  return <section className="page-section narrow"><div className="page-intro"><p className="eyebrow">STAY IN THE LOOP</p><h1>Notifications</h1><p>Updates about reports that may connect with yours.</p></div><div className="notifications">{notifications.length ? notifications.map((item) => <Notice key={item.id} icon={item.highlight ? "✦" : "✓"} title={item.title} text={item.text} time={item.time} highlight={item.highlight} />) : <div className="empty-state"><h3>No new notifications</h3><p>Your match and resolution updates will appear here.</p></div>}</div></section>;
}

function AccountView({ user, items, contactPreferences, setContactPreferences, onBrowseReports }: { user: User; items: Item[]; contactPreferences: ContactPreferences; setContactPreferences: (value: ContactPreferences) => void; onBrowseReports: () => void }) {
  const activeItems = items.filter((item) => item.status === "active");
  const resolvedItems = items.filter((item) => item.status === "resolved");
  return <section className="page-section account-page"><div className="page-intro"><p className="eyebrow">YOUR ACCOUNT</p><h1>{user.username}</h1><p>Manage your campus profile and keep track of your lost and found activity.</p></div><div className="account-layout"><section className="account-profile"><span className="account-avatar">{getInitials(user.username)}</span><div><h2>Student profile</h2><p>{user.email || "Campus email not provided"}</p><span className="account-number">Student number: {user.identifier}</span></div></section><section className="account-panel"><div className="account-panel-heading"><div><p className="eyebrow">ACTIVE LISTINGS</p><h2>Your active reports</h2></div><strong>{activeItems.length}</strong></div>{activeItems.length ? <div className="account-list">{activeItems.map((item) => <ItemCard key={item.id} item={item} onClick={() => onBrowseReports()} />)}</div> : <p className="account-empty">You have no active listings.</p>}</section><section className="account-panel"><div className="account-panel-heading"><div><p className="eyebrow">CONTACT PREFERENCES</p><h2>How we reach you</h2></div><span className="preference-state">Enabled</span></div><label className="preference-row"><span>Email updates</span><input type="checkbox" checked={contactPreferences.emailUpdates} onChange={(event) => setContactPreferences({ ...contactPreferences, emailUpdates: event.target.checked })} /></label><label className="preference-row"><span>Match alerts</span><input type="checkbox" checked={contactPreferences.matchAlerts} onChange={(event) => setContactPreferences({ ...contactPreferences, matchAlerts: event.target.checked })} /></label></section><section className="account-panel"><div className="account-panel-heading"><div><p className="eyebrow">RESOLUTION HISTORY</p><h2>Resolved reports</h2></div><strong>{resolvedItems.length}</strong></div>{resolvedItems.length ? <div className="account-list">{resolvedItems.map((item) => <ItemCard key={item.id} item={item} onClick={onBrowseReports} />)}</div> : <p className="account-empty">Resolved reports will appear here.</p>}</section></div></section>;
}

function Notice({ icon, title, text, time, highlight = false }: { icon: string; title: string; text: string; time: string; highlight?: boolean }) { return <article className={`notice ${highlight ? "highlight" : ""}`}><span className="notice-icon">{icon}</span><div><strong>{title}</strong><p>{text}</p><small>{time}</small></div>{highlight && <b className="unread" />}</article>; }

function ItemCard({ item, onClick }: { item: Item; onClick: () => void }) { return <button className="item-card" onClick={onClick}><span className="item-symbol">{categoryIcon[item.category]}</span><span className="item-content"><strong>{item.title}</strong><span>{item.location} <i>·</i> {formatDate(item.date_event)}</span></span><span className={`status ${item.status}`}>{item.status === "resolved" ? "Resolved" : item.category === "lost" ? "Lost" : "Found"}</span></button>; }

function ReportModal({ type, onClose, onSubmit }: { type: ItemCategory; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <div className="modal-backdrop"><form className="modal" onSubmit={onSubmit}><button type="button" className="close" onClick={onClose}>×</button><p className="eyebrow">NEW REPORT</p><h2>Report {type} item</h2><p className="modal-copy">Share a few details so the campus community can help.</p><label>Item name<input name="title" required placeholder={type === "lost" ? "e.g. Black iPhone 14" : "e.g. Brown leather wallet"} /></label><label>Description<textarea name="description" required placeholder="Include useful identifying details" /></label><label>{type === "lost" ? "Last seen location" : "Found at"}<input name="location" required placeholder="Building or area" /></label><label>Date {type === "lost" ? "lost" : "found"}<input name="date_event" type="date" required /></label><button className={`button ${type === "lost" ? "dark" : "gold"}`} type="submit">Submit {type} item report <span>→</span></button></form></div>; }

function ItemModal({ item, onClose, onResolve }: { item: Item; onClose: () => void; onResolve: (id: string) => void }) { return <div className="modal-backdrop"><div className="modal detail-modal"><button className="close" onClick={onClose}>×</button><div className="detail-image">{categoryIcon[item.category]}</div><span className={`status ${item.status}`}>{item.status === "resolved" ? "Resolved" : item.category === "lost" ? "Lost" : "Found"}</span><h2>{item.title}</h2><p className="detail-category">{item.category === "lost" ? "Lost item" : "Found item"} · Reported by {item.reporter || "Campus user"}</p><p>{item.description}</p><div className="detail-meta"><span>⌖ <b>Location</b> {item.location}</span><span>▣ <b>Date</b> {formatDate(item.date_event)}</span></div><p className="privacy-note">Bring your student card and proof of ownership to Campus Security.</p>{item.status === "active" && <button className="button dark" onClick={() => onResolve(item.id)}>Mark as resolved</button>}</div></div>; }

function ProtocolModal({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop"><div className="modal"><button className="close" onClick={onClose}>×</button><p className="eyebrow">SECURITY PROTOCOL</p><h2>Release checklist</h2><p className="modal-copy">Complete each check before releasing an item to a student.</p><ul className="protocol-list"><li>Verify the claimant matches the item description and campu s record.</li><li>Confirm proof of ownership or a valid student identification match.</li><li>Sign the release and note the responsible staff member for audit.</li><li>Mark the item as resolved only after collection is confirmed.</li></ul></div></div>;
}

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
    if (busy) return;

    setBusy(true);
    try {
      if (mode === "login") {
        await onLogin(accountType, identifier, password);
      } else {
        await onRegister(accountType, name, surname, email, identifier, password);
        setMode("login");
      }
    } finally {
      setBusy(false);
    }
  }

  const isRegistering = mode === "register";
  return <main className="login-shell"><div className="login-art"><button className="brand" aria-label="CampusLink"><span>UF</span><strong>Campus<span>Link</span></strong></button><div><p className="eyebrow">CAMPUS LOST &amp; FOUND</p><h1>Find what matters.<br /><em>Return what doesn&apos;t.</em></h1><p>A trusted board for the campus community.</p></div><small>Lost and found, together.</small></div><section className="login-panel"><div className="login-heading"><p className="eyebrow">{isRegistering ? "JOIN CAMPUSLINK" : "WELCOME BACK"}</p><h2>{isRegistering ? "Create your account" : "Sign in to CampusLink"}</h2><p>{isRegistering ? "Use your campus details to join the board." : "Use your campus credentials to continue."}</p></div><div className="account-switch"><button type="button" className={accountType === "student" ? "selected" : ""} onClick={() => setAccountType("student")}>Student</button><button type="button" className={accountType === "staff" ? "selected" : ""} onClick={() => setAccountType("staff")}>Campus Security</button></div><form onSubmit={submit} className="login-form">{isRegistering && <div className="name-fields"><label>Name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="First name" autoComplete="given-name" /></label><label>Surname<input required value={surname} onChange={(event) => setSurname(event.target.value)} placeholder="Surname" autoComplete="family-name" /></label></div>}{isRegistering && <label>{accountType === "student" ? "Student email" : "Staff email"}<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@tut4life.ac.za" autoComplete="email" /></label>}<label>{accountType === "student" ? "Student number" : "Staff number"}<input required value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={accountType === "student" ? "e.g. 202312345" : "e.g. SEC-001"} autoComplete={accountType === "student" ? "username" : "off"} /></label><label>Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" /></label>{error && <p className="error-message">{error}</p>}{message && <p className="success-message">{message}</p>}<button type="submit" className="button dark" disabled={busy}>{busy ? "Please wait..." : isRegistering ? "Create account" : "Sign in"}</button><button type="button" className="text-button" onClick={() => setMode(isRegistering ? "login" : "register")}>{isRegistering ? "Already have an account? Sign in" : "Need an account? Create one"}</button></form></section></main>;
}

function SecurityDashboard({ user, items, onLogout, onResolve, onLogFound, onViewProtocol }: { user: User; items: Item[]; onLogout: () => void; onResolve: (id: string) => void; onLogFound: () => void; onViewProtocol: () => void }) {
  const activeItems = items.filter((item) => item.status === "active");
  return <main className="security-shell"><header className="security-header"><div><p className="eyebrow">CAMPUS SECURITY</p><h1>Good morning, {user.username}</h1><p>Custody and collection overview</p></div><div className="security-actions"><span className="security-avatar">{getInitials(user.username)}</span><button onClick={onLogout}>Sign out</button></div></header><section className="security-content"><div className="security-stats"><div><strong>{activeItems.length}</strong><span>In custody</span></div><div><strong>{items.filter((item) => item.category === "lost" && item.status === "active").length}</strong><span>Awaiting matches</span></div><div><strong>{items.filter((item) => item.status === "resolved").length}</strong><span>Resolved</span></div></div><div className="security-title"><div><p className="eyebrow">TODAY&apos;S WORK QUEUE</p><h2>Manage items</h2></div><button className="button gold" onClick={onLogFound}>+ Log found item</button></div><div className="security-layout"><div className="custody-list">{activeItems.map((item) => <article className="custody-card" key={item.id}><span className="item-symbol">{categoryIcon[item.category]}</span><div><strong>{item.title}</strong><p>{item.location} · Received {formatDate(item.date_event)}</p><span className="status active">Awaiting collection</span></div><button onClick={() => onResolve(item.id)}>Release item</button></article>)}</div><aside className="security-note"><span>✓</span><h3>Release checklist</h3><p>Verify student ID, proof of ownership, and item condition before releasing an item.</p><button className="text-button" onClick={onViewProtocol}>View protocol ↗</button></aside></div></section></main>;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDate(date: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`)); }
