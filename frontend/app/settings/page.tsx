'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { authAPI, notificationsAPI } from '@/lib/api';
import { NotificationPreferenceItem } from '@/types';
import {
  User,
  Shield,
  Plus,
  Lock,
  CheckCircle,
  XCircle,
  Bell,
  Mail,
  Monitor,
} from 'lucide-react';

interface UserRecord {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login?: string;
}

const ROLE_OPTIONS = ['admin', 'reviewer', 'viewer'];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  reviewer: 'Reviewer',
  viewer: 'Viewer',
  api: 'API',
};

const ROLE_BADGE_VARIANT: Record<string, 'success' | 'info' | 'default' | 'warning'> = {
  admin: 'success',
  reviewer: 'info',
  viewer: 'default',
  api: 'warning',
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'users'>('account');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Users list
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Create user modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState('viewer');
  const [createError, setCreateError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  // Notification preferences
  const [preferences, setPreferences] = useState<NotificationPreferenceItem[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState('');

  const isAdmin = user?.role === 'admin';

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const res = await authAPI.listUsers();
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin]);

  const fetchPreferences = useCallback(async () => {
    setPrefsLoading(true);
    try {
      const res = await notificationsAPI.getPreferences();
      setPreferences(res.data.preferences || []);
    } catch {
      // silent
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      fetchUsers();
    }
    if (activeTab === 'notifications') {
      fetchPreferences();
    }
  }, [activeTab, isAdmin, fetchUsers, fetchPreferences]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    setPasswordSaving(true);
    try {
      await authAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err?.response?.data?.detail || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSaving(true);
    try {
      await authAPI.createUser({
        email: createEmail,
        username: createUsername,
        full_name: createFullName,
        password: createPassword,
        role: createRole,
      });
      setCreateOpen(false);
      setCreateEmail('');
      setCreateUsername('');
      setCreateFullName('');
      setCreatePassword('');
      setCreateRole('viewer');
      fetchUsers();
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleToggleActive = async (userId: string, currentlyActive: boolean) => {
    try {
      await authAPI.updateUser(userId, { is_active: !currentlyActive });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update user:', err);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await authAPI.updateUser(userId, { role: newRole });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const togglePreference = (index: number, field: 'in_app_enabled' | 'email_enabled') => {
    setPreferences(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: !updated[index][field] };
      return updated;
    });
    setPrefsSuccess('');
  };

  const handleSavePreferences = async () => {
    setPrefsSaving(true);
    setPrefsSuccess('');
    try {
      await notificationsAPI.updatePreferences(
        preferences.map(p => ({
          notification_type: p.notification_type,
          in_app_enabled: p.in_app_enabled,
          email_enabled: p.email_enabled,
        }))
      );
      setPrefsSuccess('Preferences saved successfully');
    } catch {
      // silent
    } finally {
      setPrefsSaving(false);
    }
  };

  const tabs = [
    { key: 'account' as const, label: 'Account' },
    { key: 'notifications' as const, label: 'Notifications' },
    ...(isAdmin ? [{ key: 'users' as const, label: 'User Management' }] : []),
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your account, notifications, and platform users</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Account Tab */}
        {activeTab === 'account' && user && (
          <div className="max-w-2xl space-y-6">
            {/* Profile Info */}
            <Card>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-14 w-14 rounded-full bg-green-600 flex items-center justify-center shadow-sm">
                  <span className="text-xl font-bold text-white">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{user.full_name}</h2>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
                <Badge variant={ROLE_BADGE_VARIANT[user.role] || 'default'} className="ml-auto">
                  {ROLE_LABELS[user.role] || user.role}
                </Badge>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Email</span>
                  <span className="text-gray-900 font-mono">{user.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Role</span>
                  <span className="text-gray-900 capitalize">{ROLE_LABELS[user.role] || user.role}</span>
                </div>
              </div>
            </Card>

            {/* Change Password */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-5 w-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    required
                    minLength={8}
                  />
                </div>

                {passwordError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{passwordSuccess}</div>
                )}

                <Button type="submit" size="sm" disabled={passwordSaving}>
                  {passwordSaving ? 'Changing...' : 'Change Password'}
                </Button>
              </form>
            </Card>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="max-w-2xl space-y-6">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Choose which notifications you receive in-app and via email.
              </p>

              {prefsLoading ? (
                <div className="text-center py-8 text-gray-500">Loading preferences...</div>
              ) : (
                <>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr,80px,80px] gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <span className="text-xs font-medium text-gray-500 uppercase">Notification Type</span>
                      <span className="text-xs font-medium text-gray-500 uppercase text-center flex items-center justify-center gap-1">
                        <Monitor className="h-3 w-3" /> In-App
                      </span>
                      <span className="text-xs font-medium text-gray-500 uppercase text-center flex items-center justify-center gap-1">
                        <Mail className="h-3 w-3" /> Email
                      </span>
                    </div>

                    {/* Rows */}
                    {preferences.map((pref, idx) => (
                      <div
                        key={pref.notification_type}
                        className={`grid grid-cols-[1fr,80px,80px] gap-2 px-4 py-3 items-center ${
                          idx < preferences.length - 1 ? 'border-b border-gray-100' : ''
                        }`}
                      >
                        <span className="text-sm font-medium text-gray-700">{pref.label}</span>
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => togglePreference(idx, 'in_app_enabled')}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              pref.in_app_enabled ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                                pref.in_app_enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                              }`}
                              style={{ transform: pref.in_app_enabled ? 'translateX(18px)' : 'translateX(2px)' }}
                            />
                          </button>
                        </div>
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => togglePreference(idx, 'email_enabled')}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              pref.email_enabled ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm`}
                              style={{ transform: pref.email_enabled ? 'translateX(18px)' : 'translateX(2px)' }}
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {prefsSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 mt-4">
                      {prefsSuccess}
                    </div>
                  )}

                  <div className="mt-4">
                    <Button size="sm" onClick={handleSavePreferences} disabled={prefsSaving}>
                      {prefsSaving ? 'Saving...' : 'Save Preferences'}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {/* User Management Tab (admin only) */}
        {activeTab === 'users' && isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900">Platform Users</h2>
                <Badge variant="default">{users.length} user{users.length !== 1 ? 's' : ''}</Badge>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setCreateError('');
                  setCreateOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add User
              </Button>
            </div>

            {usersLoading ? (
              <div className="text-center py-12 text-gray-500">Loading users...</div>
            ) : (
              <Card padding={false}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Username</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Last Login</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                              <p className="text-xs text-gray-500">{u.email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 font-mono">{u.username}</td>
                          <td className="py-3 px-4">
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                              disabled={u.id === user?.id}
                              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            {u.is_active ? (
                              <Badge variant="success">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="danger">
                                <XCircle className="h-3 w-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-500">
                            {u.last_login
                              ? new Date(u.last_login).toLocaleDateString()
                              : 'Never'}
                          </td>
                          <td className="py-3 px-4">
                            {u.id !== user?.id && (
                              <Button
                                size="sm"
                                variant={u.is_active ? 'danger' : 'secondary'}
                                onClick={() => handleToggleActive(u.id, u.is_active)}
                              >
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Create User Modal */}
        <Modal
          open={createOpen}
          onOpenChange={setCreateOpen}
          title="Add New User"
          size="md"
        >
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  required
                  minLength={3}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                  ))}
                </select>
              </div>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={createSaving}>
                {createSaving ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
