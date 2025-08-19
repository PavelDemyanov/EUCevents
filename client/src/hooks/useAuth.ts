import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, login, logout, type LoginCredentials, type AdminUser } from "@/lib/auth";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getCurrentUser,
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (user: AdminUser) => {
      queryClient.setQueryData(["/api/auth/me"], user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
    },
  });
}
