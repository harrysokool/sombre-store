"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { AdminAccountPanel } from "@/components/admin/admin-account-panel";
import { AdminNav } from "@/components/admin/admin-nav";
import {
  ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY,
  readAdminSidebarPreference,
  writeAdminSidebarPreference,
} from "@/lib/admin/sidebar-preference";

type AdminDesktopSidebarProps = {
  email?: string | null;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950";

function createSidebarPreferenceStore() {
  const listeners = new Set<() => void>();
  let hasVolatilePreference = false;
  let volatileCollapsed = false;

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const getSnapshot = () => {
    if (hasVolatilePreference) {
      return volatileCollapsed;
    }

    return !readAdminSidebarPreference().expanded;
  };

  const getServerSnapshot = () => false;

  const subscribe = (listener: () => void) => {
    listeners.add(listener);

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY
      ) {
        return;
      }

      hasVolatilePreference = false;
      notify();
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", handleStorage);
    };
  };

  const setCollapsed = (collapsed: boolean) => {
    writeAdminSidebarPreference(!collapsed);

    // Keep this mounted sidebar usable even if storage can be written but not
    // read back (or vice versa). A remount still falls back through the guarded
    // persisted preference path.
    hasVolatilePreference = true;
    volatileCollapsed = collapsed;
    notify();
  };

  return {
    getServerSnapshot,
    getSnapshot,
    setCollapsed,
    subscribe,
  };
}

export function AdminDesktopSidebar({
  email,
}: AdminDesktopSidebarProps) {
  const [store] = useState(createSidebarPreferenceStore);
  const isCollapsed = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const toggleLabel = isCollapsed ? "Expand sidebar" : "Collapse sidebar";
  const ToggleIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      aria-label="Admin sidebar"
      data-sidebar-state={isCollapsed ? "collapsed" : "expanded"}
      className={`sticky top-0 hidden h-dvh min-w-0 shrink-0 flex-col overflow-x-clip border-r border-white/10 bg-stone-950/70 py-6 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex ${
        isCollapsed ? "w-[4.5rem] px-2" : "w-60 px-4"
      }`}
    >
      <div
        className={`flex min-h-14 border-b border-white/10 pb-5 ${
          isCollapsed
            ? "items-start justify-center"
            : "items-start justify-between gap-3 px-3"
        }`}
      >
        <div className={isCollapsed ? "sr-only" : "min-w-0"}>
          <p className="truncate font-display text-2xl font-normal tracking-[0.18em] text-stone-100">
            Sombre
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.28em] text-stone-400">
            Admin
          </p>
        </div>

        <button
          type="button"
          aria-controls="admin-desktop-sidebar-content"
          aria-expanded={!isCollapsed}
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={() => store.setCollapsed(!isCollapsed)}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-stone-300 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white ${focusRing}`}
        >
          <ToggleIcon aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      <div
        id="admin-desktop-sidebar-content"
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 overflow-y-auto py-6">
          <AdminNav
            variant="desktop"
            collapsed={isCollapsed}
            ariaLabel="Admin primary navigation"
          />
        </div>

        <div className="shrink-0">
          <AdminAccountPanel collapsed={isCollapsed} email={email} />
        </div>
      </div>
    </aside>
  );
}
