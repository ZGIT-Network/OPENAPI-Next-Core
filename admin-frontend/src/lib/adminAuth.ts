const API_BASE_URL = "/admin/api";

export async function hasAdminSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/session`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return false;

    const data = await res.json().catch(() => null);
    return data?.authenticated === true;
  } catch {
    return false;
  }
}

export async function requireAdminSession(onUnauthorized: () => void): Promise<boolean> {
  const authenticated = await hasAdminSession();
  if (!authenticated) {
    onUnauthorized();
    return false;
  }
  return true;
}

export async function logoutAdminSession() {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => undefined);
}
