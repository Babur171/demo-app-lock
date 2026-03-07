import { createMMKV } from 'react-native-mmkv';
import type { InstalledApp } from 'react-native-app-lock';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

const mmkv = createMMKV({
  id: 'applock-store',
});

const mmkvStorage: StateStorage = {
  getItem: (name: string) => {
    const value = mmkv.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    mmkv.set(name, value);
  },
  removeItem: (name: string) => {
    mmkv.remove(name);
  },
};

type AppLockState = {
  apps: InstalledApp[];
  lockedPackages: string[];
  hasAccessibility: boolean;
  hasOverlay: boolean;
  lastSyncedAt: number | null;
  setApps: (apps: InstalledApp[]) => void;
  setLockedPackages: (packages: string[]) => void;
  setPermissions: (permissions: {
    hasAccessibility?: boolean;
    hasOverlay?: boolean;
  }) => void;
  clearState: () => void;
};

export const useAppLockStore = create<AppLockState>()(
  persist(
    set => ({
      apps: [],
      lockedPackages: [],
      hasAccessibility: false,
      hasOverlay: true,
      lastSyncedAt: null,
      setApps: apps =>
        set({
          apps,
          lastSyncedAt: Date.now(),
        }),
      setLockedPackages: packages =>
        set({
          lockedPackages: packages,
          lastSyncedAt: Date.now(),
        }),
      setPermissions: permissions =>
        set(state => ({
          hasAccessibility:
            permissions.hasAccessibility ?? state.hasAccessibility,
          hasOverlay: permissions.hasOverlay ?? state.hasOverlay,
          lastSyncedAt: Date.now(),
        })),
      clearState: () =>
        set({
          apps: [],
          lockedPackages: [],
          hasAccessibility: false,
          hasOverlay: true,
          lastSyncedAt: Date.now(),
        }),
    }),
    {
      name: 'applock-state-v1',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: state => ({
        apps: state.apps,
        lockedPackages: state.lockedPackages,
        hasAccessibility: state.hasAccessibility,
        hasOverlay: state.hasOverlay,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
);
