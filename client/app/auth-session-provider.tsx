"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

export type User = {
  id?: string;
  username: string;
  email?: string;
  account_type: "student" | "staff";
  identifier: string;
};

type AuthSessionValue = {
  user: User | null;
  setUser: (user: User | null) => void;
  authChecking: boolean;
  authError: string;
  setAuthError: (message: string) => void;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "production" ? "/api/v1" : "http://localhost:3001/api/v1");
const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const startupHandled = useRef(false);

  useEffect(() => {
    if (startupHandled.current) return;
    startupHandled.current = true;

    try {
      localStorage.removeItem("campuslink_token");
      localStorage.removeItem("campuslink_user");
    } catch (error) {
      console.error("[Auth] Could not clear legacy browser session data", { error });
    }

    void fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (response.ok) return;
        const responseBody = await response.text();
        console.error("[Auth] Fresh-load session clear failed", {
          status: response.status,
          responseBody,
        });
        setAuthError("Could not clear the previous session. Sign in to continue; your new sign-in will replace it.");
      })
      .catch((error) => {
        console.error("[Auth] Could not clear the previous session on fresh page load", { error });
        setAuthError("Could not clear the previous session. Sign in to continue; your new sign-in will replace it.");
      })
      .finally(() => {
        setUser(null);
        setAuthChecking(false);
      });
  }, []);

  return (
    <AuthSessionContext.Provider value={{ user, setUser, authChecking, authError, setAuthError }}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const session = useContext(AuthSessionContext);
  if (!session) throw new Error("useAuthSession must be used within AuthSessionProvider");
  return session;
}
