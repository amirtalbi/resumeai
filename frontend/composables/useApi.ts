export const useApi = () => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  const apiFetch = async <T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (authStore.accessToken) {
      headers["Authorization"] = `Bearer ${authStore.accessToken}`;
    }

    const response = await fetch(`${config.public.apiBase}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (response.status === 401) {
      const refreshed = await authStore.refreshToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${authStore.accessToken}`;
        const retryResponse = await fetch(
          `${config.public.apiBase}${endpoint}`,
          { ...options, headers, credentials: "include" },
        );
        if (!retryResponse.ok) {
          throw new Error(`API error: ${retryResponse.status}`);
        }
        return retryResponse.json();
      }

      authStore.logout();
      navigateTo("/login");
      throw new Error("Session expired");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  };

  const uploadFile = async <T>(
    endpoint: string,
    file: File,
    fieldName = "file",
  ): Promise<T> => {
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers: Record<string, string> = {};
    if (authStore.accessToken) {
      headers["Authorization"] = `Bearer ${authStore.accessToken}`;
    }

    const response = await fetch(`${config.public.apiBase}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Upload error: ${response.status}`);
    }

    return response.json();
  };

  const downloadBlob = async (endpoint: string): Promise<Blob> => {
    const headers: Record<string, string> = {};
    if (authStore.accessToken) {
      headers["Authorization"] = `Bearer ${authStore.accessToken}`;
    }

    const response = await fetch(`${config.public.apiBase}${endpoint}`, {
      method: "POST",
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Download error: ${response.status}`);
    }

    return response.blob();
  };

  return {
    get: <T>(endpoint: string) => apiFetch<T>(endpoint),
    post: <T>(endpoint: string, body?: unknown) =>
      apiFetch<T>(endpoint, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      }),
    put: <T>(endpoint: string, body?: unknown) =>
      apiFetch<T>(endpoint, {
        method: "PUT",
        body: body ? JSON.stringify(body) : undefined,
      }),
    delete: <T>(endpoint: string) =>
      apiFetch<T>(endpoint, { method: "DELETE" }),
    upload: uploadFile,
    download: downloadBlob,
    stream: (endpoint: string) => {
      const controller = new AbortController();

      const connect = () =>
        fetch(`${config.public.apiBase}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${authStore.accessToken}`,
            Accept: "text/event-stream",
          },
          credentials: "include",
          signal: controller.signal,
        });

      return { connect, abort: () => controller.abort() };
    },
  };
};
