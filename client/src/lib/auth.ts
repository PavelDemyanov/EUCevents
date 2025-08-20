import { apiRequest } from "./queryClient";

export interface AdminUser {
  id: number;
  username: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export async function login(credentials: LoginCredentials): Promise<AdminUser> {
  const response = await apiRequest("/api/auth/login", {
    method: "POST",
    body: credentials
  });
  const data = await response.json();
  return data.admin;
}

export async function logout(): Promise<void> {
  await apiRequest("/api/auth/logout", {
    method: "POST"
  });
}

export async function getCurrentUser(): Promise<AdminUser | null> {
  try {
    const response = await apiRequest("/api/auth/me");
    return await response.json();
  } catch (error) {
    return null;
  }
}
