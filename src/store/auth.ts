import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createApiClient, WHAMApiClient } from '../api/client';
import type { AuthConfig } from '../types';

interface AuthState {
  config: AuthConfig;
  client: WHAMApiClient | null;
  isConnected: boolean;
  setConfig: (config: AuthConfig) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      config: { subject: '', apiKey: '', baseUrl: '' },
      client: null,
      isConnected: false,

      setConfig: (config) => {
        set({ config, isConnected: false, client: null });
      },

      connect: async () => {
        const { config } = get();
        const client = createApiClient(config);
        try {
          await client.ping();
          set({ client, isConnected: true });
          return true;
        } catch {
          set({ client: null, isConnected: false });
          return false;
        }
      },

      disconnect: () => {
        set({ client: null, isConnected: false });
      },
    }),
    {
      name: 'wham-auth',
      partialize: (s) => ({ config: s.config }),
    }
  )
);
