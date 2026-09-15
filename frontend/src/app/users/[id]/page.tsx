"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ApiError, getUser } from "@/lib/api";
import { UserStatusBadge } from "@/components/status-badge";
import { SyncedUser } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="text-sm text-foreground break-words">{children}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-white p-5">
      <h2 className="mb-3.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">{children}</div>
    </div>
  );
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<SyncedUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUser(id)
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "Failed to load user.");
        }
      });
  }, [id]);

  return (
    <div>
      <Link href="/" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        &larr; Back to users
      </Link>

      {notFound && (
        <div className="rounded-md border border-err bg-err-soft px-3.5 py-2.5 text-sm text-err">
          No user found with that id.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-err bg-err-soft px-3.5 py-2.5 text-sm text-err">
          {error}
        </div>
      )}

      {!user && !notFound && !error && <div className="py-8 text-center text-muted">Loading…</div>}

      {user && (
        <>
          <div className="mb-5">
            <h2 className="text-lg font-semibold">{user.name}</h2>
            <p className="text-sm text-muted">{user.email}</p>
          </div>

          <Card title="Account">
            <Field label="Status">
              <span className="flex items-center gap-2">
                <UserStatusBadge status={user.status} />
                {user.isDeleted && (
                  <span className="rounded-full bg-err-soft px-2 py-0.5 text-xs font-medium text-err">
                    no longer in customer dataset
                  </span>
                )}
              </span>
            </Field>
            <Field label="Phone">{user.phone ?? "—"}</Field>
            <Field label="Internal id">
              <span className="font-mono text-xs text-muted">{user.id}</span>
            </Field>
          </Card>

          <Card title="Company">
            <Field label="Company">{user.company ?? "—"}</Field>
            <Field label="Industry">{user.companyIndustry ?? "—"}</Field>
            <Field label="Role">{user.companyRole ?? "—"}</Field>
          </Card>

          <Card title="Synchronization">
            <Field label="Source created">{new Date(user.sourceCreatedAt).toLocaleString()}</Field>
            <Field label="Source last updated">{new Date(user.sourceUpdatedAt).toLocaleString()}</Field>
            <Field label="Last synced by us">{new Date(user.syncedAt).toLocaleString()}</Field>
          </Card>
        </>
      )}
    </div>
  );
}
