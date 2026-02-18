import React, { useState } from "react";
import { useAppState } from "../store";
import { setToken, setRefreshToken } from "../api";

export function AccountSettings() {
  const state = useAppState();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    setToken(null);
    setRefreshToken(null);
    localStorage.clear();
    window.location.reload();
  };

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;
    setBusy(true);
    setError(null);
    try {
      const token = localStorage.getItem("botschat_token");
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setToken(null);
      setRefreshToken(null);
      localStorage.clear();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Info */}
      <div>
        <h3 className="text-h3 font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Account
        </h3>
        <div className="space-y-1.5">
          <p className="text-body" style={{ color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--text-muted)" }}>Email: </span>
            {state.user?.email ?? "—"}
          </p>
        </div>
      </div>

      {/* Logout */}
      <div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-md text-caption font-bold"
          style={{ background: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          Sign Out
        </button>
      </div>

      {/* Danger Zone */}
      <div
        className="p-4 rounded-md border"
        style={{ borderColor: "var(--accent-red, #e53e3e)", background: "rgba(255, 0, 0, 0.04)" }}
      >
        <h4 className="text-caption font-bold mb-2" style={{ color: "var(--accent-red, #e53e3e)" }}>
          Danger Zone
        </h4>
        <p className="text-caption mb-3" style={{ color: "var(--text-muted)" }}>
          Permanently delete your account and all associated data (messages, channels,
          automations, media). This action cannot be undone.
        </p>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 rounded-md text-caption font-bold"
            style={{ background: "var(--accent-red, #e53e3e)", color: "#fff" }}
          >
            Delete Account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-caption font-bold" style={{ color: "var(--text-primary)" }}>
              Type <code style={{ color: "var(--accent-red, #e53e3e)" }}>DELETE</code> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 rounded border text-body"
              style={{ background: "var(--bg-input, var(--bg-surface))", borderColor: "var(--border)", color: "var(--text-primary)" }}
              placeholder="DELETE"
              autoFocus
            />
            {error && <p className="text-caption" style={{ color: "var(--accent-red, #e53e3e)" }}>{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={confirmText !== "DELETE" || busy}
                className="px-4 py-2 rounded-md text-caption font-bold"
                style={{
                  background: "var(--accent-red, #e53e3e)",
                  color: "#fff",
                  opacity: confirmText !== "DELETE" || busy ? 0.5 : 1,
                }}
              >
                {busy ? "Deleting..." : "Permanently Delete"}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(""); setError(null); }}
                className="px-4 py-2 rounded-md text-caption font-bold"
                style={{ background: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
