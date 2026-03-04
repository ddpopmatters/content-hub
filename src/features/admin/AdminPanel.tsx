import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardTitle, Button, Modal } from '../../components/ui';
import { cx } from '../../lib/utils';
import { FEATURE_OPTIONS } from '../../constants';
import type { User, AuditEntry } from '../../types/models';
import { AddUserForm, type AddUserFormData } from './AddUserForm';

/** Props for AccessModal component */
interface AccessModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** User being edited (null if modal is closed) */
  user: User | null;
  /** Currently enabled features */
  features: string[];
  /** Callback when features are saved */
  onSave: (features: string[]) => void;
}

/**
 * AccessModal - Modal for managing user feature access
 */
function AccessModal({
  open,
  onClose,
  user,
  features = [],
  onSave,
}: AccessModalProps): React.ReactElement | null {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(features);

  useEffect(() => {
    setSelectedFeatures(features);
  }, [features]);

  if (!open || !user) return null;

  const toggleFeature = (key: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const canSave = selectedFeatures.length > 0;

  const modalLabelId = `feature-access-modal-${user.id}`;

  return (
    <Modal open={open} onClose={onClose} aria-labelledby={modalLabelId}>
      <div className="space-y-4 px-6 py-6">
        <div>
          <h3 id={modalLabelId} className="text-lg font-semibold text-ocean-900">
            Access for {user.name}
          </h3>
          <p className="text-xs text-graystone-500">
            Select which features this user can access. At least one selection is required.
          </p>
        </div>
        <div className="grid gap-2">
          {FEATURE_OPTIONS.map((option) => {
            const enabled = selectedFeatures.includes(option.key);
            return (
              <label
                key={option.key}
                className={cx(
                  'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition',
                  enabled
                    ? 'border-aqua-200 bg-aqua-50 text-ocean-700'
                    : 'border-graystone-200 bg-white text-graystone-600 hover:border-graystone-400',
                )}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleFeature(option.key)}
                  className="h-4 w-4 rounded border-graystone-300 text-aqua-500 focus:ring-aqua-300"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        {!canSave ? (
          <div className="text-xs text-rose-600">Select at least one feature before saving.</div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(selectedFeatures)} disabled={!canSave}>
            Save access
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export interface AdminPanelProps {
  /** Array of audit log entries */
  adminAudits: AuditEntry[];
  /** Array of user objects */
  userList: User[];
  /** Array of approver names */
  approverOptions: string[];
  /** Error message string */
  userAdminError: string;
  /** Success message string */
  userAdminSuccess: string;
  /** User object for access modal (or null) */
  accessModalUser: User | null;
  /** Array of default feature keys */
  defaultFeatures: string[];
  /** Callback to navigate back to menu */
  onBackToMenu: () => void;
  /** Callback to ping server */
  onPingServer: () => void;
  /** Callback to refresh audit logs */
  onRefreshAudits: () => void;
  /** Callback when toggling approver role (receives user) */
  onToggleApproverRole: (user: User) => void;
  /** Callback when removing user (receives user) */
  onRemoveUser: (user: User) => void;
  /** Callback to set user for access modal */
  onSetAccessModalUser: (user: User | null) => void;
  /** Callback when adding a new user (receives form data) */
  onAddUser: (data: AddUserFormData) => void;
  /** Callback when saving access modal (receives features array) */
  onAccessSave: (features: string[]) => void;
}

/**
 * AdminPanel - Admin tools view for user management and audit logs
 */
export function AdminPanel({
  adminAudits = [],
  userList = [],
  approverOptions = [],
  userAdminError = '',
  userAdminSuccess = '',
  accessModalUser = null,
  defaultFeatures = [],
  onBackToMenu,
  onPingServer,
  onRefreshAudits,
  onToggleApproverRole,
  onRemoveUser,
  onSetAccessModalUser,
  onAddUser,
  onAccessSave,
}: AdminPanelProps): React.ReactElement {
  const handleCloseAccessModal = useCallback(() => {
    onSetAccessModalUser(null);
  }, [onSetAccessModalUser]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onBackToMenu} className="self-start">
              Back to menu
            </Button>
            <h2 className="text-2xl font-semibold text-ocean-700">Admin tools</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onPingServer}>
              Ping server
            </Button>
            <Button onClick={onRefreshAudits}>Refresh audits</Button>
          </div>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg text-ocean-900">Recent audit events</CardTitle>
            <p className="mt-2 text-sm text-graystone-500">
              Pulled from the server when connected; local fallback otherwise.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {adminAudits.length === 0 ? (
                <p className="text-sm text-graystone-600">No audit events.</p>
              ) : (
                adminAudits.slice(0, 200).map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-xl border border-graystone-200 bg-white px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col">
                      <div className="font-medium text-ocean-800">{row.action || 'event'}</div>
                      <div className="text-[11px] text-graystone-600">
                        {row.user || 'Unknown'} · {row.entryId || '—'}
                      </div>
                    </div>
                    <div className="text-[11px] text-graystone-500">
                      {row.ts ? new Date(row.ts).toLocaleString() : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg text-ocean-900">Approver directory</CardTitle>
            <p className="mt-2 text-sm text-graystone-500">
              Approvers are managed via the user roster. Enable the role on a teammate to list them
              here.
            </p>
          </CardHeader>
          <CardContent>
            {approverOptions.length ? (
              <div className="flex flex-wrap gap-2">
                {approverOptions.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-aqua-100 px-3 py-1 text-xs font-semibold text-ocean-700"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-graystone-500">
                No approvers configured yet. Mark a user as an approver to add them.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg text-ocean-900">User roster</CardTitle>
            <p className="mt-2 text-sm text-graystone-500">
              Add new users (first + last + email); they'll be emailed when created.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userList.length ? (
                userList.map((user) => (
                  <div
                    key={user.id || user.email || user.name}
                    className="rounded-xl border border-graystone-200 bg-white px-3 py-3 text-sm text-graystone-700"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium text-graystone-900">{user.name}</div>
                        <div className="text-[11px] text-graystone-500">
                          {user.email || 'No email'} ·{' '}
                          {user.status === 'disabled'
                            ? 'Disabled'
                            : user.invitePending || user.status === 'pending'
                              ? 'Invite pending'
                              : 'Active'}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-semibold uppercase text-graystone-500">
                          {user.isAdmin ? (
                            <span className="rounded-full bg-ocean-50 px-2 py-0.5 text-ocean-700">
                              Admin
                            </span>
                          ) : null}
                          {user.isApprover ? (
                            <span className="rounded-full bg-aqua-50 px-2 py-0.5 text-ocean-700">
                              Approver
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onToggleApproverRole(user)}
                        >
                          {user.isApprover ? 'Remove approver' : 'Make approver'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSetAccessModalUser(user)}
                        >
                          Access
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onRemoveUser(user)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-graystone-500">No users configured yet.</p>
              )}
            </div>
            <AddUserForm
              defaultFeatures={defaultFeatures}
              onSubmit={onAddUser}
              error={userAdminError}
              success={userAdminSuccess}
            />
          </CardContent>
        </Card>
      </div>

      <AccessModal
        open={Boolean(accessModalUser)}
        user={accessModalUser}
        features={accessModalUser?.features || defaultFeatures}
        onClose={handleCloseAccessModal}
        onSave={onAccessSave}
      />
    </>
  );
}

export default AdminPanel;
