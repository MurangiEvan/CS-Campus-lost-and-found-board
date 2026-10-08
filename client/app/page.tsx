"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type ReportType = "lost" | "found";
type ItemCategory = "cards" | "keys" | "phones" | "bags" | "other";
type ItemStatus = "active" | "resolved";
type View = "home" | "browse" | "reports" | "notifications" | "account" | "forgot-password" | "reset-password";
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
  category: ReportType;
  item_category?: ItemCategory;
  location: string;
  date_event: string;
  status: ItemStatus;
  user_id?: string;
  reporter?: string;
  image_url?: string | null;
  resolution_notes?: string | null;
  custodian_name?: string | null;
  custody_status?: "in_custody" | "released" | null;
  storage_location?: string | null;
  custodian_user_id?: string | null;
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

type AuditEvent = {
  id: string;
  user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  created_at: string;
};

type CustodyEvent = {
  id: string;
  item_id: string;
  actor_id: string;
  actor_name: string;
  event_type: "intake" | "reassigned" | "released";
  details: {
    storage_location?: string;
    from_user_id?: string;
    to_user_id?: string;
    verification?: ReleaseVerification;
    notes?: string | null;
  };
  from_user_name?: string | null;
  to_user_name?: string | null;
  created_at: string;
};

type ResolutionEvent = {
  id: string;
  item_id: string;
  resolved_by: string;
  notes: string | null;
  created_at: string;
};

type ReleaseVerification = {
  student_id_verified: boolean;
  proof_of_ownership_confirmed: boolean;
  item_condition_noted: boolean;
};

type ApiItem = {
  id: string;
  title: string;
  description: string;
  category: ReportType;
  item_category?: ItemCategory;
  resolution_notes?: string | null;
  location: string;
  date_event: string;
  status: ItemStatus;
  user_id?: string;
  image_url?: string | null;
  custodian_name?: string | null;
  custody_status?: "in_custody" | "released" | null;
  storage_location?: string | null;
  custodian_user_id?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "production" ? "/api/v1" : "http://localhost:3001/api/v1");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const categoryIcon: Record<string, string> = { lost: "↗", found: "⌕", cards: "▣", keys: "⌕", phones: "▤", bags: "□", other: "•" };
const defaultContactPreferences: ContactPreferences = { emailUpdates: true, matchAlerts: true };

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function viewFromPath(pathname: string): View {
  const segment = pathname.split("/")[2];
  return ["browse", "reports", "notifications", "account", "forgot-password", "reset-password"].includes(segment) ? segment as View : "home";
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({ error: "Request failed" }));
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : typeof data?.message === "string" ? data.message : "Request failed";
    throw new ApiError(message, response.status);
  }

  return data as T;
}

async function compressImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be opened. Choose a different photo.");
  }

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");

    let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const qualities = [0.82, 0.7, 0.58, 0.46];

    for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of qualities) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Unable to compress this image.")), "image/jpeg", quality);
        });
        if (blob.size <= MAX_IMAGE_BYTES) return blob;
      }

      scale *= 0.75;
    }

    throw new Error("This photo is too large to attach. Choose a smaller image.");
  } finally {
    bitmap.close();
  }
}

async function uploadImage(blob: Blob) {
  const signed = await apiRequest<{ upload_id: string; url: string; fields: Record<string, string> }>("/uploads/presign", {
    method: "POST",
    body: JSON.stringify({ content_type: blob.type, size: blob.size }),
  });
  const form = new FormData();
  Object.entries(signed.fields).forEach(([key, value]) => form.append(key, value));
  form.append("file", blob, "item-photo.jpg");
  try {
    const response = await fetch(signed.url, { method: "POST", body: form });
    if (!response.ok) throw new Error("Photo upload failed. Please try again.");
  } catch (error) {
    await apiRequest(`/uploads/${signed.upload_id}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
  return signed.upload_id;
}

function mapApiItem(item: ApiItem): Item {
  return {
    ...item,
    reporter: item.user_id || "Campus user",
  };
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const view = viewFromPath(pathname);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [pendingResolution, setPendingResolution] = useState<Item | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionBusy, setResolutionBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("lost");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ReportType>("all");
  const [itemCategory, setItemCategory] = useState<"all" | ItemCategory>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [location, setLocation] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsRefreshKey, setItemsRefreshKey] = useState(0);
  const [browseItems, setBrowseItems] = useState<Item[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [authForgotError, setAuthForgotError] = useState("");
  const [authForgotMessage, setAuthForgotMessage] = useState("");
  const [authResetError, setAuthResetError] = useState("");
  const [authResetMessage, setAuthResetMessage] = useState("");
  const [contactPreferences, setContactPreferences] = useState<ContactPreferences>(defaultContactPreferences);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [resolutions, setResolutions] = useState<ResolutionEvent[]>([]);
  const [resolutionsLoading, setResolutionsLoading] = useState(false);
  const [resolutionsOpen, setResolutionsOpen] = useState(false);
  const [resolutionsError, setResolutionsError] = useState("");
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [custodyHistoryItem, setCustodyHistoryItem] = useState<Item | null>(null);
  const [custodyEvents, setCustodyEvents] = useState<CustodyEvent[]>([]);
  const [custodyEventsLoading, setCustodyEventsLoading] = useState(false);
  const [custodyEventsError, setCustodyEventsError] = useState("");
  const [selectedReassignItemId, setSelectedReassignItemId] = useState<string | null>(null);
  const [reassigningItemId, setReassigningItemId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportMessage, setReportMessage] = useState("");

  function navigateToView(nextView: View) {
    if (user) router.push(nextView === "home" ? "/app" : `/app/${nextView}`);
  }

  useEffect(() => {
    localStorage.removeItem("campuslink_token");
    localStorage.removeItem("campuslink_user");
    void apiRequest<User>("/auth/session")
      .then((sessionUser) => {
        setUser(sessionUser);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    if (!user) return;

    void apiRequest<ContactPreferences>("/auth/preferences").then(setContactPreferences).catch(() => undefined);

    const loadItems = async () => {
      setItemsLoading(true);
      setItemsError("");
      try {
        const data = await apiRequest<ApiItem[]>("/items?status=all");
        setItems(data.map(mapApiItem));
      } catch (error) {
        setItemsError(error instanceof Error ? error.message : "Unable to load items");
      } finally {
        setItemsLoading(false);
      }
    };

    void loadItems();
  }, [itemsRefreshKey, user]);

  useEffect(() => {
    if (user?.account_type !== "staff") return;

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") setItemsRefreshKey((current) => current + 1);
    };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("token")) {
      router.replace(`/app/reset-password?token=${params.get("token")}`);
    }
    const paramsFilter = new URLSearchParams({ status: showArchived ? "resolved" : "active" });
    if (search.trim()) paramsFilter.set("search", search.trim());
    if (filter !== "all") paramsFilter.set("category", filter);
    if (itemCategory !== "all") paramsFilter.set("item_category", itemCategory);
    if (dateFrom) paramsFilter.set("date_from", dateFrom);
    if (dateTo) paramsFilter.set("date_to", dateTo);
    if (location.trim()) paramsFilter.set("location", location.trim());

    const loadBrowseItems = async () => {
      setBrowseLoading(true);
      try {
        const data = await apiRequest<ApiItem[]>(`/items?${paramsFilter.toString()}`);
        setBrowseItems(data.map(mapApiItem));
      } catch (error) {
        setItemsError(error instanceof Error ? error.message : "Unable to search items");
      } finally {
        setBrowseLoading(false);
      }
    };

    const timeout = window.setTimeout(() => {
      void loadBrowseItems();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [dateFrom, dateTo, filter, itemCategory, location, search, showArchived, user, router]);

  const notifications: NotificationItem[] = user ? [
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
    ] : [];

  useEffect(() => {
    localStorage.setItem("campuslink_contact_preferences", JSON.stringify(contactPreferences));
    if (user) {
      void apiRequest("/auth/preferences", { method: "PATCH", body: JSON.stringify(contactPreferences) }).catch(() => undefined);
    }
  }, [contactPreferences, user]);

  const visibleItems = browseItems;

  function openReport(type: ReportType) {
    setReportType(type);
    setReportError("");
    setReportMessage("");
    setShowReport(true);
  }

  async function openResolutionsForItem(id: string) {
    setResolutionsError("");
    setResolutions([]);
    setResolutionsLoading(true);
    try {
      const data = await apiRequest<ResolutionEvent[]>(`/items/${id}/resolutions`);
      setResolutions(data);
      setResolutionsOpen(true);
    } catch (error) {
      setResolutionsError(error instanceof Error ? error.message : "Unable to load resolutions");
    } finally {
      setResolutionsLoading(false);
    }
  }

  async function reassignItem(id: string, newUserId: string) {
    if (reassigningItemId) return;
    setReassigningItemId(id);
    setItemsError("");
    try {
      const item = await apiRequest<ApiItem>(`/items/${id}/reassign`, { method: 'PATCH', body: JSON.stringify({ user_id: newUserId }) });
      setItems((current) => current.map((entry) => entry.id === id ? mapApiItem(item) : entry));
      setReportMessage("Custody assignment updated.");
      setItemsRefreshKey((current) => current + 1);
    } catch (error) {
      setItemsError(error instanceof Error ? error.message : 'Unable to reassign the item');
    } finally {
      setReassigningItemId(null);
    }
  }

  async function openUserSearch(itemId?: string) {
    setSelectedReassignItemId(itemId || null);
    setUserSearchOpen(true);
  }

  async function openAudit() {
    try {
      const rows = await apiRequest<AuditEvent[]>('/admin/audit');
      setAuditEvents(rows);
      setAuditOpen(true);
    } catch {
      setAuditEvents([]);
      setAuditOpen(true);
    }
  }

  async function openCustodyHistory(item: Item) {
    setCustodyHistoryItem(item);
    setCustodyEvents([]);
    setCustodyEventsError("");
    setCustodyEventsLoading(true);
    try {
      setCustodyEvents(await apiRequest<CustodyEvent[]>(`/items/${item.id}/custody-events`));
    } catch (error) {
      setCustodyEventsError(error instanceof Error ? error.message : "Unable to load custody history");
    } finally {
      setCustodyEventsLoading(false);
    }
  }


  // when a user is selected in the modal, call reassign for the selected item id
  function handleUserSelect(userId: string) {
    if (!selectedReassignItemId) return;
    void reassignItem(selectedReassignItemId, userId);
    setUserSearchOpen(false);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionLoading) return;
    const data = new FormData(event.currentTarget);

    setReportError("");
    setReportMessage("");
    setActionLoading(true);
    let imageUploadId: string | undefined;
    try {
      const image = data.get("image");
      if (image instanceof File && image.size) {
        const compressedImage = await compressImage(image);
        imageUploadId = await uploadImage(compressedImage);
      }
      const description = String(data.get("description"));
      const droppedOffBy = String(data.get("dropped_off_by") || "").trim();
      const securityIntake = user?.account_type === "staff";
      const item = await apiRequest<ApiItem>(securityIntake ? "/items/intake" : "/items", {
        method: "POST",
        body: JSON.stringify({
          title: String(data.get("title")),
          description,
          category: securityIntake ? "found" : reportType,
          item_category: String(data.get("item_category") || "other"),
          location: String(data.get(securityIntake ? "found_at" : "location")),
          date_event: String(data.get("date_event")),
          ...(securityIntake ? { storage_location: String(data.get("storage_location")), dropped_off_by: droppedOffBy } : {}),
          ...(imageUploadId ? { image_upload_id: imageUploadId } : {}),
        }),
      });

      setItems((current) => [mapApiItem(item), ...current]);
      setReportMessage(imageUploadId ? "Report submitted and photo uploaded." : "Report submitted successfully.");
      setShowReport(false);
      if (user?.account_type !== "staff") navigateToView("reports");
    } catch (error) {
      if (imageUploadId) {
        await apiRequest(`/uploads/${imageUploadId}`, { method: "DELETE" }).catch(() => undefined);
      }
      setReportError(error instanceof Error ? error.message : "Unable to create the report");
    } finally {
      setActionLoading(false);
    }
  }

  function requestResolution(item: Item) {
    setItemsError("");
    setPendingResolution(item);
    setResolutionNotes(item.resolution_notes || "");
  }

  async function resolveItem(id: string, notes = "", verification?: ReleaseVerification) {
    setItemsError("");
    setResolutionBusy(true);
    try {
      const item = await apiRequest<ApiItem>(`/items/${id}/resolve`, { method: "PATCH", body: JSON.stringify({ notes, ...(verification ? { verification } : {}) }) });
      const mapped = mapApiItem(item);
      setItems((current) => current.map((entry) => entry.id === id ? mapped : entry));
      setBrowseItems((current) => current.map((entry) => entry.id === id ? mapped : entry));
      setSelectedItem((current) => current && current.id === id ? mapped : current);
      setPendingResolution(null);
      setResolutionNotes("");
    } catch (error) {
      setItemsError(error instanceof Error ? error.message : "Unable to resolve the item");
    } finally {
      setResolutionBusy(false);
    }
  }

  async function deleteItem(id: string) {
    setActionLoading(true);
    try {
      await apiRequest(`/items/${id}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => item.id !== id));
      setSelectedItem(null);
    } catch (error) {
      setItemsError(error instanceof Error ? error.message : "Unable to delete the report");
    } finally {
      setActionLoading(false);
    }
  }

  async function updateItem(id: string, updates: { title: string; description: string; location: string; date_event: string }) {
    setActionLoading(true);
    try {
      const item = await apiRequest<ApiItem>(`/items/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
      const mapped = mapApiItem(item);
      setItems((current) => current.map((entry) => entry.id === id ? mapped : entry));
      setSelectedItem(mapped);
    } catch (error) {
      setItemsError(error instanceof Error ? error.message : "Unable to update the report");
    } finally {
      setActionLoading(false);
    }
  }

  async function forgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthForgotError("");
    setAuthForgotMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: String(data.get("email")) }),
      });
      setAuthForgotMessage("If an account exists with this email, a reset link has been sent.");
    } catch (error) {
      setAuthForgotError(error instanceof Error ? error.message : "Unable to process request");
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthResetError("");
    setAuthResetMessage("");
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setAuthResetError("Missing security token");
      return;
    }
    try {
      await apiRequest<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          newPassword: String(data.get("password")),
        }),
      });
      setAuthResetMessage("Password has been reset successfully. You can now sign in.");
      setTimeout(() => router.replace("/"), 3000);
    } catch (error) {
      setAuthResetError(error instanceof Error ? error.message : "Unable to reset password");
    }
  }

  async function login(identifier: string, password: string) {
    setAuthError("");
    setAuthMessage("");
    try {
      const result = await apiRequest<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      const nextUser = result.user;
      setUser(nextUser);
      // Route from the account type returned by the server, not a form choice.
      router.replace(nextUser.account_type === "staff" ? "/app/security-dashboard" : "/app/student-dashboard");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthError("Invalid email or password");
      } else if (error instanceof ApiError && error.status === 429) {
        setAuthError("Too many sign-in attempts. Please wait 15 minutes, then try again.");
      } else {
        setAuthError("Sign-in is temporarily unavailable. Check your connection and try again.");
      }
    }
  }

  async function register(accountType: AccountType, name: string, surname: string, email: string, identifier: string, password: string, confirmPassword: string): Promise<boolean> {
    setAuthError("");
    setAuthMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedIdentifier = identifier.trim();
    const expectedEmail = `${normalizedIdentifier.toLowerCase()}@tut4life.ac.za`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setAuthError("Enter a valid campus email address.");
      return false;
    }
    if (password.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return false;
    }
    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return false;
    }
    if (email.trim().toLowerCase() !== expectedEmail) {
      setAuthError(`Use ${expectedEmail} for this account.`);
      return false;
    }

    try {
      await apiRequest<{ message: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: `${name.trim()} ${surname.trim()}`,
          email: normalizedEmail,
          password,
          account_type: accountType,
          confirm_password: confirmPassword,
          ...(accountType === "student" ? { student_number: normalizedIdentifier } : { staff_number: normalizedIdentifier }),
        }),
      });
      setAuthMessage("Account created. Sign in with your campus email or number and password.");
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to create account");
      return false;
    }
  }

  function logout() {
    void apiRequest("/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setItems([]);
    setSelectedItem(null);
    router.replace("/");
  }

  if (authChecking) return <main className="login-shell"><p role="status">Checking your session…</p></main>;
  if (!user) {
    if (view === "forgot-password") return <ForgotPasswordPage onForgot={forgotPassword} error={authForgotError} message={authForgotMessage} onBack={() => router.replace("/app")} />;
    if (view === "reset-password") return <ResetPasswordPage onReset={resetPassword} error={authResetError} message={authResetMessage} />;
    return <LoginPage onLogin={login} onRegister={register} error={authError} message={authMessage} onForgot={() => router.push("/app/forgot-password")} />;
  }
  if (user.account_type === "staff") {
    return (
      <>
        <SecurityDashboard
          user={user}
          items={items}
          onLogout={logout}
          onResolve={requestResolution}
          onLogFound={() => openReport("found")}
          onViewProtocol={() => setProtocolOpen(true)}
          onOpenAudit={openAudit}
          onReassign={(itemId) => void openUserSearch(itemId)}
          reassigningItemId={reassigningItemId}
          onViewCustodyHistory={(item) => void openCustodyHistory(item)}
          onRefresh={() => setItemsRefreshKey((current) => current + 1)}
          itemsLoading={itemsLoading}
          actionLoading={actionLoading}
        />
        {reportMessage && <div className="security-feedback form-message" role="status">{reportMessage}</div>}
        {itemsError && <div className="security-feedback error-banner" role="alert">{itemsError}</div>}
        {showReport && <ReportModal type={reportType} securityIntake busy={actionLoading} error={reportError} onClose={() => setShowReport(false)} onSubmit={submitReport} />}
        {pendingResolution && <ResolutionModal item={pendingResolution} requireChecks notes={resolutionNotes} setNotes={setResolutionNotes} busy={resolutionBusy} error={itemsError} onClose={() => setPendingResolution(null)} onConfirm={(notes, verification) => void resolveItem(pendingResolution.id, notes ?? resolutionNotes, verification)} />}
        {protocolOpen && <ProtocolModal onClose={() => setProtocolOpen(false)} />}
        {userSearchOpen && <UserSearchModal onClose={() => setUserSearchOpen(false)} onSelect={handleUserSelect} />}
        {auditOpen && <AuditModal onClose={() => setAuditOpen(false)} events={auditEvents} />}
        {custodyHistoryItem && <CustodyHistoryModal item={custodyHistoryItem} events={custodyEvents} loading={custodyEventsLoading} error={custodyEventsError} onClose={() => setCustodyHistoryItem(null)} />}
      </>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigateToView("home")} aria-label="Go to home"><span>UF</span><strong>Campus<span>Link</span></strong></button>
        {view !== "home" && <button type="button" className="dashboard-back-button" onClick={() => navigateToView("home")}><span aria-hidden="true">←</span>Back to dashboard</button>}
        <nav className="topnav" aria-label="Main navigation">
          <button type="button" aria-current={view === "home" ? "page" : undefined} className={view === "home" ? "active" : ""} onClick={() => navigateToView("home")}>Home</button>
          <button type="button" aria-current={view === "browse" ? "page" : undefined} className={view === "browse" ? "active" : ""} onClick={() => navigateToView("browse")}>Browse items</button>
          <button type="button" aria-current={view === "reports" ? "page" : undefined} className={view === "reports" ? "active" : ""} onClick={() => navigateToView("reports")}>My reports</button>
          <button type="button" aria-current={view === "notifications" ? "page" : undefined} className={view === "notifications" ? "active" : ""} onClick={() => navigateToView("notifications")}>Notifications <b>2</b></button>
        </nav>
        <button className="user-chip" onClick={() => navigateToView("account")}><span>{getInitials(user.username)}</span><span className="user-name">{user.username}</span></button>
      </header>

      {reportMessage && <div className="form-message" role="status">{reportMessage}</div>}
      {itemsError && <div className="error-banner">{itemsError}</div>}
      {itemsLoading && <div className="loading-banner">Loading items…</div>}

      {view === "home" && <HomeView user={user} items={items} onBrowse={() => navigateToView("browse")} onReport={openReport} onSelect={setSelectedItem} />}
      {view === "browse" && <BrowseView items={visibleItems} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} itemCategory={itemCategory} setItemCategory={setItemCategory} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} location={location} setLocation={setLocation} showArchived={showArchived} setShowArchived={setShowArchived} loading={browseLoading} onSelect={setSelectedItem} onReport={openReport} />}
      {view === "reports" && <ReportsView items={items.filter((item) => item.user_id === user.id)} onSelect={setSelectedItem} onReport={openReport} />}
      {view === "notifications" && <NotificationsView notifications={notifications} />}
      {view === "account" && <AccountView user={user} items={items.filter((item) => item.user_id === user.id)} contactPreferences={contactPreferences} setContactPreferences={setContactPreferences} onBrowseReports={() => navigateToView("reports")} />}

      <footer className="footer"><span>CampusLink</span><span>Lost and found, together.</span><button onClick={logout}>Sign out</button></footer>

      {showReport && <ReportModal type={reportType} busy={actionLoading} error={reportError} onClose={() => setShowReport(false)} onSubmit={submitReport} />}
      {selectedItem && <ItemModal item={selectedItem} canManage={selectedItem.user_id === user.id} canResolve={selectedItem.user_id === user.id} onClose={() => setSelectedItem(null)} onResolve={requestResolution} onDelete={deleteItem} onUpdate={updateItem} />}
      {pendingResolution && <ResolutionModal item={pendingResolution} notes={resolutionNotes} setNotes={setResolutionNotes} busy={resolutionBusy} error={itemsError} onClose={() => setPendingResolution(null)} onConfirm={() => void resolveItem(pendingResolution.id, resolutionNotes)} />}
      {protocolOpen && <ProtocolModal onClose={() => setProtocolOpen(false)} />}
    </main>
  );
}

function UserSearchModal({ onClose, onSelect }: { onClose: () => void; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; username: string; email?: string; student_number?: string; staff_number?: string }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) return;

    let active = true;
    const timer = window.setTimeout(() => {
      void apiRequest<Array<{ id: string; username: string; email?: string; student_number?: string; staff_number?: string }>>(`/admin/users?q=${encodeURIComponent(query.trim())}`)
        .then((results) => {
          if (active) setUsers(results);
        })
        .catch((searchError) => {
          if (active) setError(searchError instanceof Error ? searchError.message : "Unable to search campus users");
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="user-search-title"><button className="close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">CUSTODY HANDOVER</p><h2 id="user-search-title">Search campus staff</h2><label className="search"><input value={query} onChange={(event) => { setQuery(event.target.value); setUsers([]); setError(""); }} placeholder="Search by staff name, email, or number" /></label>{error ? <p className="form-error" role="alert">{error}</p> : users.length ? <ul className="user-results">{users.map((user) => <li key={user.id}><strong>{user.username}</strong><small>{user.email || user.student_number || user.staff_number}</small><button onClick={() => { onSelect(user.id); onClose(); }}>Select</button></li>)}</ul> : <p className="empty-state">{query.trim().length < 2 ? "Enter at least 2 characters" : "No matching staff"}</p>}<div className="modal-footer"><button className="button" onClick={onClose}>Close</button></div></section></div>;
}

function AuditModal({ onClose, events }: { onClose: () => void; events: AuditEvent[] }) {
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="audit-title"><button className="close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">AUDIT LOG</p><h2 id="audit-title">Recent staff actions</h2>{events.length ? <ul className="audit-list">{events.map((event) => <li key={event.id}><strong>{event.action}</strong> by <small>{event.user_id}</small> — <code>{event.target_type}:{event.target_id}</code><br /><small>{new Date(event.created_at).toLocaleString()}</small></li>)}</ul> : <p className="empty-state">No audit events</p>}<div className="modal-footer"><button className="button" onClick={onClose}>Close</button></div></section></div>;
}

function CustodyHistoryModal({ item, events, loading, error, onClose }: { item: Item; events: CustodyEvent[]; loading: boolean; error: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="custody-history-title">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">CUSTODY RECORD</p>
        <h2 id="custody-history-title">{item.title}</h2>
        <p className="modal-copy">Current storage: {item.storage_location || "Not recorded"}</p>
        {loading ? <p role="status">Loading custody history…</p> : error ? <p className="form-error" role="alert">{error}</p> : events.length ? (
          <ol className="audit-list">
            {events.map((event) => (
              <li key={event.id}>
                <strong>{event.event_type}</strong> by {event.actor_name}
                <br />
                <small>{new Date(event.created_at).toLocaleString()}</small>
                {event.details.storage_location && <p>Storage: {event.details.storage_location}</p>}
                {event.details.from_user_id && <p>Reassigned from {event.from_user_name || "Staff account"} to {event.to_user_name || "Staff account"}</p>}
                {event.details.verification && <p>Release checks: student ID, ownership, and item condition recorded.</p>}
                {event.details.notes && <p>{event.details.notes}</p>}
              </li>
            ))}
          </ol>
        ) : <p className="empty-state">No custody events recorded.</p>}
        <div className="modal-footer"><button className="button" onClick={onClose}>Close</button></div>
      </section>
    </div>
  );
}

function HomeView({ user, items, onBrowse, onReport, onSelect }: { user: User; items: Item[]; onBrowse: () => void; onReport: (type: ReportType) => void; onSelect: (item: Item) => void }) {
  const activeCount = items.filter((item) => item.user_id === user.id && item.status === "active").length;
  const firstName = user.username.trim().split(/\s+/)[0] || user.username;

  return <section className="student-dashboard">
    <header className="student-dashboard-header"><div><p>Good morning</p><h1>{firstName} <span aria-hidden="true">👋</span></h1><div><span>{activeCount} active reports</span><span>Campus Security verified</span></div></div><span className="student-dashboard-avatar">{getInitials(user.username)}</span></header>
    <div className="student-dashboard-content">
      <div className="student-dashboard-actions"><button className="dark" onClick={() => onReport("lost")}><span aria-hidden="true">⌕</span>Report Lost</button><button className="gold" onClick={() => onReport("found")}><span aria-hidden="true">＋</span>Report Found</button></div>
      <div className="security-section-heading"><h2>Recent on campus</h2><button className="text-button" onClick={onBrowse}>View all</button></div>
      <div className="item-grid">{items.slice(0, 3).map((item) => <ItemCard key={item.id} item={item} onClick={() => onSelect(item)} />)}</div>
      {!items.length && <div className="empty-state"><h3>No recent reports</h3><p>New campus reports will appear here.</p></div>}
    </div>
  </section>;
}

function BrowseView({ items, search, setSearch, filter, setFilter, itemCategory, setItemCategory, dateFrom, setDateFrom, dateTo, setDateTo, location, setLocation, showArchived, setShowArchived, loading, onSelect, onReport }: { items: Item[]; search: string; setSearch: (value: string) => void; filter: "all" | ReportType; setFilter: (value: "all" | ReportType) => void; itemCategory: "all" | ItemCategory; setItemCategory: (value: "all" | ItemCategory) => void; dateFrom: string; setDateFrom: (value: string) => void; dateTo: string; setDateTo: (value: string) => void; location: string; setLocation: (value: string) => void; showArchived: boolean; setShowArchived: (value: boolean) => void; loading: boolean; onSelect: (item: Item) => void; onReport: (type: ReportType) => void }) {
  return <section className="page-section"><div className="page-intro"><p className="eyebrow">THE BOARD</p><h1>{showArchived ? "Resolved history" : "Browse items"}</h1><p>Search reports from across campus and help bring something home.</p></div><div className="toolbar"><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item or detail" /></label><label>Building<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Library, residence..." /></label><label>From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label>To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label><div className="filters"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "lost" ? "selected" : ""} onClick={() => setFilter("lost")}>Lost</button><button className={filter === "found" ? "selected" : ""} onClick={() => setFilter("found")}>Found</button></div><div className="filters"><button className={itemCategory === "all" ? "selected" : ""} onClick={() => setItemCategory("all")}>All types</button>{(["cards", "keys", "phones", "bags"] as ItemCategory[]).map((value) => <button key={value} className={itemCategory === value ? "selected" : ""} onClick={() => setItemCategory(value)}>{value}</button>)}</div><button className="text-button" onClick={() => setShowArchived(!showArchived)}>{showArchived ? "Active reports" : "Resolved history"}</button></div><div className="browse-layout"><div className="browse-list">{loading ? <div className="empty-state"><h3>Searching reports...</h3></div> : items.length ? items.map((item) => <ItemCard key={item.id} item={item} onClick={() => onSelect(item)} />) : <div className="empty-state"><span>⌕</span><h3>No matching reports</h3><p>Try a broader search or report the item yourself.</p><button className="button gold" onClick={() => onReport("lost")}>Create a report</button></div>}</div><aside className="side-callout"><span className="callout-icon">+</span><h3>Have you found something?</h3><p>Small details can make a big difference. Add it to the board so its owner can find it.</p><button className="button gold" onClick={() => onReport("found")}>Report found item</button></aside></div></section>;
}

function ReportsView({ items, onSelect, onReport }: { items: Item[]; onSelect: (item: Item) => void; onReport: (type: ReportType) => void }) {
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

function ItemCard({ item, onClick }: { item: Item; onClick: () => void }) { return <button className="item-card" onClick={onClick}><span className="item-symbol">{categoryIcon[item.item_category || item.category]}</span><span className="item-content"><strong>{item.title}</strong><span>{item.location} <i>·</i> {formatDate(item.date_event)}</span></span><span className={`status ${item.status}`}>{item.status === "resolved" ? "Resolved" : item.category === "lost" ? "Lost" : "Found"}</span></button>; }

function ReportModal({ type, securityIntake = false, busy = false, error = "", onClose, onSubmit }: { type: ReportType; securityIntake?: boolean; busy?: boolean; error?: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoName, setPhotoName] = useState("");

  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setPhotoPreview(file ? URL.createObjectURL(file) : "");
    setPhotoName(file?.name || "");
  }

  return <div className="modal-backdrop"><form className={`modal report-modal ${securityIntake ? "security-intake-modal" : ""}`} onSubmit={onSubmit}>
    <button type="button" className="close report-modal-close" onClick={onClose} aria-label="Close">×</button>
    <p className="eyebrow">{securityIntake ? "CAMPUS SECURITY" : "NEW REPORT"}</p>
    <h2>{securityIntake ? "Log found item" : `Report ${type} item`}</h2>
    <p className="modal-copy">{securityIntake ? "Record the found item and where it is being held." : "Share a few details so the campus community can help."}</p>
    <label>{securityIntake ? "Item description" : "Item name"}<input name="title" required placeholder={type === "lost" ? "e.g. Black iPhone 14" : "e.g. Brown leather wallet"} /></label>
    <label>{securityIntake ? "Identifying details" : "Description"}<textarea name="description" required placeholder="Include useful identifying details" /></label>
    <label>Item type<select name="item_category" defaultValue="other"><option value="cards">Cards</option><option value="keys">Keys</option><option value="phones">Phones</option><option value="bags">Bags</option><option value="other">Other</option></select></label>
    {securityIntake ? <>
      <label>Dropped off by<input name="dropped_off_by" placeholder="Student name or number" /></label>
      <label>Date received<input name="date_event" type="date" required /></label>
      <label>Found at<input name="found_at" required placeholder="Campus location" /></label>
      <label>Storage location<input name="storage_location" required placeholder="Shelf or bin reference" /></label>
    </> : <>
      <label>{type === "lost" ? "Last seen location" : "Found at"}<select name="location" required defaultValue=""><option value="" disabled>Select a campus location</option><option>Library</option><option>Campus Security Desk</option><option>Student Centre</option><option>Main Quad</option><option>Residence Hall</option><option>Dining Hall</option><option>Lecture Building</option></select></label>
      <label>Date {type === "lost" ? "lost" : "found"}<input name="date_event" type="date" required /></label>
    </>}
    <label className="photo-input"><span>＋</span> Add an optional photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} /></label>
    {photoPreview && <div className="photo-upload-preview" role="status"><img src={photoPreview} alt="Selected item" /><span>Photo ready: {photoName}</span></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className={`button ${type === "lost" ? "dark" : "gold"}`} type="submit" disabled={busy}>{busy ? (photoName ? "Uploading photo…" : "Submitting…") : securityIntake ? "Submit item intake" : `Submit ${type} item report`} {!busy && <span>→</span>}</button>
  </form></div>;
}

function ItemModal({ item, canManage, canResolve, onClose, onResolve, onDelete, onUpdate }: { item: Item; canManage: boolean; canResolve: boolean; onClose: () => void; onResolve: (item: Item) => void; onDelete: (id: string) => void; onUpdate: (id: string, updates: { title: string; description: string; location: string; date_event: string }) => void }) { const [editing, setEditing] = useState(false); return <div className="modal-backdrop"><div className="modal detail-modal"><button className="close" onClick={onClose}>×</button>{item.image_url ? <img className="detail-image" src={item.image_url} alt={item.title} /> : <div className="detail-image">{categoryIcon[item.item_category || item.category]}</div>}<span className={`status ${item.status}`}>{item.status === "resolved" ? "Resolved" : item.category === "lost" ? "Lost" : "Found"}</span>{editing ? <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onUpdate(item.id, { title: String(data.get("title")), description: String(data.get("description")), location: String(data.get("location")), date_event: String(data.get("date_event")) }); setEditing(false); }}><label>Title<input name="title" defaultValue={item.title} required /></label><label>Description<textarea name="description" defaultValue={item.description} required /></label><label>Location<input name="location" defaultValue={item.location} required /></label><label>Date<input name="date_event" type="date" defaultValue={item.date_event} required /></label><button className="button dark" type="submit">Save changes</button></form> : <><h2>{item.title}</h2><p className="detail-category">{item.category === "lost" ? "Lost item" : "Found item"} · Reported by {item.reporter || "Campus user"}</p><p>{item.description}</p><div className="detail-meta"><span>⌖ <b>Location</b> {item.location}</span><span>▣ <b>Date</b> {formatDate(item.date_event)}</span></div><p className="privacy-note">Bring your student card and proof of ownership to Campus Security.</p>{item.status === "active" && canResolve && <button className="button dark" onClick={() => onResolve(item)}>Mark as resolved</button>}{item.status === "active" && canManage && <div className="detail-actions"><button className="button gold" onClick={() => setEditing(true)}>Edit report</button><button className="text-button" onClick={() => onDelete(item.id)}>Delete report</button></div>}</>}</div></div>; }

function ResolutionModal({ item, requireChecks = false, notes, setNotes, busy, error, onClose, onConfirm }: { item: Item; requireChecks?: boolean; notes: string; setNotes: (value: string) => void; busy: boolean; error: string; onClose: () => void; onConfirm: (notes?: string, verification?: ReleaseVerification) => void }) {
  const [checks, setChecks] = useState({ studentId: false, ownership: false, condition: false });
  const checksComplete = Object.values(checks).every(Boolean);

  function confirmRelease() {
    const verification: ReleaseVerification | undefined = requireChecks ? {
      student_id_verified: checks.studentId,
      proof_of_ownership_confirmed: checks.ownership,
      item_condition_noted: checks.condition,
    } : undefined;
    onConfirm(notes.trim(), verification);
  }

  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="resolution-title">
    <button className="close" onClick={onClose} disabled={busy} aria-label="Close">×</button>
    <p className="eyebrow">COLLECTION VERIFICATION</p>
    <h2 id="resolution-title">Release {item.title}</h2>
    <p className="modal-copy">{item.location} · Received {formatDate(item.date_event)}. Complete every check before releasing this item from Campus Security custody.</p>
    {requireChecks && <fieldset className="release-checklist"><legend>Verification checklist</legend>
      <label className={checks.studentId ? "checked" : ""}><input type="checkbox" checked={checks.studentId} onChange={(event) => setChecks({ ...checks, studentId: event.target.checked })} />Student ID verified</label>
      <label className={checks.ownership ? "checked" : ""}><input type="checkbox" checked={checks.ownership} onChange={(event) => setChecks({ ...checks, ownership: event.target.checked })} />Proof of ownership confirmed</label>
      <label className={checks.condition ? "checked" : ""}><input type="checkbox" checked={checks.condition} onChange={(event) => setChecks({ ...checks, condition: event.target.checked })} />Item condition noted</label>
    </fieldset>}
    <label>Security notes (optional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add condition or handover notes" maxLength={1000} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="detail-actions"><button className={`button ${requireChecks ? "gold" : "dark"}`} onClick={confirmRelease} disabled={busy || (requireChecks && !checksComplete)}>{busy ? "Saving…" : "Release item"}</button><button className="text-button" onClick={onClose} disabled={busy}>Cancel</button></div>
  </section></div>;
}

function ProtocolModal({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="protocol-title"><button className="close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">SECURITY PROTOCOL</p><h2 id="protocol-title">Release checklist</h2><p className="modal-copy">Complete each check before releasing an item to a student.</p><ul className="protocol-list"><li>Verify the claimant matches the item description and campus record.</li><li>Confirm proof of ownership or a valid student identification match.</li><li>Note item condition and the responsible staff member in the release record.</li><li>Mark the item resolved only after collection is confirmed.</li></ul></section></div>;
}

function ForgotPasswordPage({ onForgot, error, message, onBack }: { onForgot: (event: FormEvent<HTMLFormElement>) => void; error: string; message: string; onBack: () => void }) {
  return <main className="login-shell"><div className="login-art"><button className="brand" aria-label="CampusLink"><span>UF</span><strong>Campus<span>Link</span></strong></button><div><p className="eyebrow">RESET ACCESS</p><h1>Forgot your password?</h1><p>We can send you a secure reset link if the account exists.</p></div><small>Lost and found, together.</small></div><section className="login-panel"><div className="login-heading"><p className="eyebrow">PASSWORD RECOVERY</p><h2>Request a reset link</h2></div><form className="login-form" onSubmit={onForgot}><label>Campus email<input name="email" type="email" required placeholder="you@tut4life.ac.za" autoComplete="email" /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}<button className="button dark" type="submit">Send reset link</button><button type="button" className="text-button" onClick={onBack}>Back to sign in</button></form></section></main>;
}

function ResetPasswordPage({ onReset, error, message }: { onReset: (event: FormEvent<HTMLFormElement>) => void; error: string; message: string }) {
  return <main className="login-shell"><div className="login-art"><button className="brand" aria-label="CampusLink"><span>UF</span><strong>Campus<span>Link</span></strong></button><div><p className="eyebrow">SECURE ACCESS</p><h1>Reset your password</h1><p>Choose a new password for your CampusLink account.</p></div><small>Lost and found, together.</small></div><section className="login-panel"><div className="login-heading"><p className="eyebrow">NEW PASSWORD</p><h2>Set a strong password</h2></div><form className="login-form" onSubmit={onReset}><label>New password<input name="password" type="password" required minLength={8} placeholder="At least 8 characters" autoComplete="new-password" /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}<button className="button dark" type="submit">Update password</button></form></section></main>;
}

function LoginPage({ onLogin, onRegister, error, message, onForgot }: { onLogin: (identifier: string, password: string) => Promise<void>; onRegister: (accountType: AccountType, name: string, surname: string, email: string, identifier: string, password: string, confirmPassword: string) => Promise<boolean>; error: string; message: string; onForgot: () => void }) {
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    try {
      if (mode === "login") {
        await onLogin(identifier, password);
      } else {
        const registered = await onRegister(accountType, name, surname, email, identifier, password, confirmPassword);
        if (registered) {
          setMode("login");
          setPassword("");
          setConfirmPassword("");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const isRegistering = mode === "register";
  return (
    <main className="login-shell">
      <div className="login-art"><button className="brand" aria-label="CampusLink"><span>UF</span><strong>Campus<span>Link</span></strong></button><div><p className="eyebrow">CAMPUS LOST &amp; FOUND</p><h1>Find what matters.<br /><em>Return what doesn&apos;t.</em></h1><p>A trusted board for the campus community.</p></div><small>Lost and found, together.</small></div>
      <section className="login-panel">
        <div className="login-heading"><p className="eyebrow">{isRegistering ? "JOIN CAMPUSLINK" : "WELCOME BACK"}</p><h2>{isRegistering ? "Create your account" : "Sign in to CampusLink"}</h2><p>{isRegistering ? "Use your campus details to join the board." : "Use your campus credentials to continue."}</p></div>
        {isRegistering && <div className="account-switch" role="radiogroup" aria-label="Account type"><button type="button" role="radio" aria-checked={accountType === "student"} className={accountType === "student" ? "selected" : ""} onClick={() => setAccountType("student")}>Student</button><button type="button" role="radio" aria-checked={accountType === "staff"} className={accountType === "staff" ? "selected" : ""} onClick={() => setAccountType("staff")}>Security</button></div>}
        <form onSubmit={submit} className="login-form">
          {isRegistering && <div className="name-fields"><label>First name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="First name" autoComplete="given-name" /></label><label>Surname<input required value={surname} onChange={(event) => setSurname(event.target.value)} placeholder="Surname" autoComplete="family-name" /></label></div>}
          {isRegistering && <label>{accountType === "student" ? "Student email" : "Staff email"}<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@tut4life.ac.za" autoComplete="email" /></label>}
          <label>{isRegistering ? accountType === "student" ? "Student number" : "Staff number" : "Email or campus number"}<input required type="text" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={isRegistering ? accountType === "student" ? "e.g. 202312345" : "e.g. SEC-001" : "Email or campus number"} autoComplete="username" /></label>
          <label>Password<input required type="password" minLength={isRegistering ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegistering ? "At least 8 characters" : "Password"} autoComplete={isRegistering ? "new-password" : "current-password"} /></label>
          {isRegistering && <label>Confirm password<input required type="password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" autoComplete="new-password" /></label>}
          {!isRegistering && <button type="button" className="text-button login-forgot-link" onClick={onForgot}>Forgot password?</button>}
          {error && <p className="error-message" role="alert">{error}</p>}
          {message && <p className="success-message" role="status">{message}</p>}
          <button type="submit" className="button dark" disabled={busy}>{busy ? "Please wait..." : isRegistering ? "Create account" : "Sign in"}</button>
          <button type="button" className="text-button" onClick={() => setMode(isRegistering ? "login" : "register")}>{isRegistering ? "Already have an account? Sign in" : "Need an account? Create one"}</button>
        </form>
      </section>
    </main>
  );
}

function SecurityDashboard({ user, items, onLogout, onResolve, onLogFound, onViewProtocol, onOpenAudit, onReassign, onViewCustodyHistory, reassigningItemId, onRefresh, itemsLoading = false, actionLoading }: { user: User; items: Item[]; onLogout: () => void; onResolve: (item: Item) => void; onLogFound: () => void; onViewProtocol: () => void; onOpenAudit: () => void; onReassign: (id: string) => void; onViewCustodyHistory: (item: Item) => void; reassigningItemId: string | null; onRefresh: () => void; itemsLoading?: boolean; actionLoading?: boolean }) {
  const [activeView, setActiveView] = useState<"dashboard" | "items" | "release">("dashboard");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ItemStatus>("all");
  const custodyItems = items.filter((item) => item.custody_status === "in_custody" && item.status === "active");
  const releaseItems = custodyItems;
  const filteredItems = items.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${item.title} ${item.description} ${item.location} ${item.storage_location || ""} ${item.custodian_name || ""}`.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });
  const recentItems = items.filter((item) => item.status === "active").slice(0, 3);
  const firstName = user.username.trim().split(/\s+/)[0] || user.username;

  function itemRow(item: Item, showReassign = false) {
    const status = item.custody_status === "released" ? "Released" : item.custody_status === "in_custody" ? "In custody" : item.category === "lost" ? "Lost report" : "Found report";
    return <article className="security-item-card" key={item.id}>
      <span className="item-symbol">{categoryIcon[item.item_category || item.category]}</span>
      <div className="security-item-content"><strong>{item.title}</strong><span>{item.item_category || item.category} · {formatDate(item.date_event)} · {item.location}</span>{item.storage_location && <span>Storage: {item.storage_location}</span>}{item.custody_status === "in_custody" && <span>Assigned to: {item.custodian_user_id === user.id ? "you" : item.custodian_name || "staff"}</span>}<span className={`status ${item.status}`}>{status}</span></div>
      <div className="security-item-actions">
        {item.custody_status === "in_custody" && item.status === "active" && item.custodian_user_id === user.id && <button className="button gold" onClick={() => onResolve(item)} disabled={Boolean(actionLoading)}>{actionLoading ? "Working…" : "Release"}</button>}
        {item.custody_status && <button className="text-button" onClick={() => onViewCustodyHistory(item)}>History</button>}
        {showReassign && item.custody_status === "in_custody" && <button className="text-button" onClick={() => onReassign(item.id)} disabled={Boolean(reassigningItemId)}>{reassigningItemId === item.id ? "Reassigning…" : "Reassign"}</button>}
      </div>
    </article>;
  }

  return <main className="security-shell">
    <header className="security-header"><div className="security-header-top"><div><p className="eyebrow">CAMPUS SECURITY</p><h1>Good morning, {firstName}</h1><div className="security-header-meta"><span>{items.filter((item) => item.status === "active").length} active reports</span><span>Campus Security verified</span></div></div><div className="security-actions"><span className="security-avatar">{getInitials(user.username)}</span><button onClick={onLogout}>Sign out</button></div></div><div className="security-stats"><div><strong>{custodyItems.length}</strong><span>In custody</span></div><div><strong>{items.filter((item) => item.category === "lost" && item.status === "active").length}</strong><span>Awaiting</span></div><div><strong>{items.filter((item) => item.status === "resolved").length}</strong><span>Resolved</span></div></div></header>
    <section className="security-content">
      {activeView !== "dashboard" && <button type="button" className="dashboard-back-button security-back-button" onClick={() => setActiveView("dashboard")}><span aria-hidden="true">←</span>Back to dashboard</button>}
      {activeView === "dashboard" && <>
        <div className="security-quick-actions"><button className="security-quick-action dark" onClick={onLogFound}><span aria-hidden="true">＋</span>Log new item</button><button className="security-quick-action gold" onClick={() => setActiveView("release")}><span aria-hidden="true">✓</span>Release item</button></div>
        <div className="security-section-heading"><h2>Recent reports</h2><div className="security-section-actions"><button className="text-button" onClick={onRefresh} disabled={itemsLoading}>{itemsLoading ? "Refreshing…" : "Refresh"}</button><button className="text-button" onClick={() => setActiveView("items")}>View all</button></div></div>
        <div className="custody-list">{recentItems.length ? recentItems.map((item) => itemRow(item)) : <div className="empty-state"><h3>No active reports</h3><p>New lost and found reports will appear here.</p></div>}</div>
        <div className="security-note"><span aria-hidden="true">✓</span><div><h3>Collection verification</h3><p>Verify student ID, proof of ownership, and item condition before releasing an item.</p></div><button className="text-button" onClick={onViewProtocol}>View protocol</button></div>
      </>}
      {activeView === "items" && <>
        <div className="security-section-heading"><div><p className="eyebrow">CUSTODY QUEUE</p><h2>Manage items</h2></div><button className="button gold" onClick={onLogFound}>＋ Log found item</button></div>
        <div className="security-toolbar"><label className="search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items or storage ref..." aria-label="Search managed items" /></label><div className="filters" aria-label="Filter by status">{(["all", "active", "resolved"] as const).map((status) => <button key={status} className={statusFilter === status ? "selected" : ""} onClick={() => setStatusFilter(status)}>{status === "all" ? "All" : status === "active" ? "Awaiting" : "Released"}</button>)}</div></div>
        <p className="security-result-count">{filteredItems.length} items currently in the queue</p>
        <div className="custody-list">{filteredItems.length ? filteredItems.map((item) => itemRow(item, true)) : <div className="empty-state"><h3>No items found</h3><p>Try another search or status filter.</p></div>}</div>
      </>}
      {activeView === "release" && <>
        <div className="security-section-heading"><div><p className="eyebrow">COLLECTION QUEUE</p><h2>Release item</h2></div><button className="text-button" onClick={onViewProtocol}>View protocol</button></div>
        <p className="security-result-count">Select an item in Security custody to verify collection and record its release.</p>
        <div className="custody-list">{releaseItems.length ? releaseItems.map((item) => itemRow(item)) : <div className="empty-state"><h3>Nothing is awaiting collection</h3><p>New found-item intake will be listed here.</p></div>}</div>
      </>}
    </section>
    <nav className="security-nav" aria-label="Security navigation">
      <button className={activeView === "dashboard" ? "active" : ""} onClick={() => setActiveView("dashboard")} aria-current={activeView === "dashboard" ? "page" : undefined}><span aria-hidden="true">⌂</span>Dashboard</button>
      <button className={activeView === "items" ? "active" : ""} onClick={() => setActiveView("items")} aria-current={activeView === "items" ? "page" : undefined}><span aria-hidden="true">▣</span>Items</button>
      <button className={activeView === "release" ? "active" : ""} onClick={() => setActiveView("release")} aria-current={activeView === "release" ? "page" : undefined}><span aria-hidden="true">✓</span>Release</button>
      <button onClick={onOpenAudit}><span aria-hidden="true">◷</span>Activity</button>
    </nav>
  </main>;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDate(date: string | null | undefined) {
  const datePart = typeof date === "string" ? date.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "Date unavailable";

  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
