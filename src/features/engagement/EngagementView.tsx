import React, { useState, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
} from '../../components/ui';
import { TrashIcon, PlusIcon } from '../../components/common';
import { cx } from '../../lib/utils';
import { selectBaseClasses } from '../../lib/styles';
import { ALL_PLATFORMS } from '../../constants';
import type {
  EngagementActivity,
  EngagementAccount,
  EngagementActionType,
  EngagementAccountType,
  EngagementGoals,
} from '../../types/models';

// Constants
const ACTION_TYPES: { value: EngagementActionType; label: string; emoji: string }[] = [
  { value: 'comment', label: 'Comment', emoji: '💬' },
  { value: 'share', label: 'Share/Repost', emoji: '🔄' },
  { value: 'reply', label: 'Reply', emoji: '↩️' },
  { value: 'like', label: 'Like', emoji: '❤️' },
  { value: 'follow', label: 'Follow', emoji: '➕' },
  { value: 'dm', label: 'DM', emoji: '✉️' },
];

const ACCOUNT_TYPES: EngagementAccountType[] = [
  'Ally',
  'Media',
  'Supporter',
  'Prospect',
  'Influencer',
  'Partner',
  'Other',
];

const ACCOUNT_TYPE_COLORS: Record<EngagementAccountType, string> = {
  Ally: 'bg-emerald-100 text-emerald-700',
  Media: 'bg-purple-100 text-purple-700',
  Supporter: 'bg-blue-100 text-blue-700',
  Prospect: 'bg-amber-100 text-amber-700',
  Influencer: 'bg-pink-100 text-pink-700',
  Partner: 'bg-cyan-100 text-cyan-700',
  Other: 'bg-graystone-100 text-graystone-700',
};

export const DEFAULT_ENGAGEMENT_GOALS: EngagementGoals = {
  weeklyComments: 20,
  weeklyShares: 10,
  weeklyReplies: 10,
  weeklyLikes: 30,
  weeklyFollows: 5,
  weeklyDms: 5,
  weekStartDay: 'monday',
};

// Helper to get the start of the current week
const getWeekStart = (weekStartDay: 'monday' | 'sunday'): Date => {
  const now = new Date();
  const day = now.getDay();
  const diff = weekStartDay === 'monday' ? (day === 0 ? -6 : 1 - day) : -day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

interface EngagementViewProps {
  activities: EngagementActivity[];
  accounts: EngagementAccount[];
  goals: EngagementGoals;
  currentUser: string;
  onAddActivity: (activity: Omit<EngagementActivity, 'id' | 'createdAt' | 'createdBy'>) => void;
  onDeleteActivity: (id: string) => void;
  onAddAccount: (account: Omit<EngagementAccount, 'id' | 'createdAt' | 'createdBy'>) => void;
  onDeleteAccount: (id: string) => void;
  onUpdateAccount: (id: string, updates: Partial<EngagementAccount>) => void;
  onUpdateGoals: (goals: EngagementGoals) => void;
}

// Quick Log Form Component
const QuickLogForm: React.FC<{
  accounts: EngagementAccount[];
  onSubmit: (activity: Omit<EngagementActivity, 'id' | 'createdAt' | 'createdBy'>) => void;
}> = ({ accounts, onSubmit }) => {
  const [platform, setPlatform] = useState(ALL_PLATFORMS[0]);
  const [accountHandle, setAccountHandle] = useState('');
  const [actionType, setActionType] = useState<EngagementActionType>('comment');
  const [note, setNote] = useState('');

  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!accountHandle.trim()) return [];
    const query = accountHandle.toLowerCase();
    return accounts
      .filter(
        (a) =>
          a.platform === platform &&
          (a.handle.toLowerCase().includes(query) || a.displayName?.toLowerCase().includes(query)),
      )
      .slice(0, 5);
  }, [accounts, accountHandle, platform]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountHandle.trim()) return;

    const matchingAccount = accounts.find(
      (a) => a.platform === platform && a.handle.toLowerCase() === accountHandle.toLowerCase(),
    );

    onSubmit({
      platform,
      accountHandle: accountHandle.trim(),
      accountId: matchingAccount?.id,
      actionType,
      note: note.trim() || undefined,
    });

    setAccountHandle('');
    setNote('');
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-lg text-ocean-900">Quick Log</CardTitle>
        <p className="text-sm text-graystone-500">Record an engagement activity</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-graystone-600">Platform</Label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className={cx(selectBaseClasses, 'w-full px-3 py-2 text-sm')}
              >
                {ALL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-graystone-600">Action</Label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as EngagementActionType)}
                className={cx(selectBaseClasses, 'w-full px-3 py-2 text-sm')}
              >
                {ACTION_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.emoji} {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 relative">
            <Label className="text-xs text-graystone-600">Account Handle</Label>
            <Input
              type="text"
              value={accountHandle}
              onChange={(e) => setAccountHandle(e.target.value)}
              placeholder="@username"
              className="w-full"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-graystone-200 rounded-xl shadow-lg">
                {suggestions.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setAccountHandle(account.handle)}
                    className="w-full text-left px-4 py-2 hover:bg-graystone-50 text-sm"
                  >
                    <span className="font-medium">{account.handle}</span>
                    {account.displayName && (
                      <span className="text-graystone-500 ml-2">{account.displayName}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-graystone-600">Note (optional)</Label>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Brief description..."
              className="w-full"
            />
          </div>

          <Button type="submit" className="w-full" disabled={!accountHandle.trim()}>
            <PlusIcon className="w-4 h-4 mr-2" />
            Log Activity
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Activity List Component
const ActivityList: React.FC<{
  activities: EngagementActivity[];
  onDelete: (id: string) => void;
  platformFilter: string;
  actionFilter: string;
}> = ({ activities, onDelete, platformFilter, actionFilter }) => {
  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (platformFilter && a.platform !== platformFilter) return false;
      if (actionFilter && a.actionType !== actionFilter) return false;
      return true;
    });
  }, [activities, platformFilter, actionFilter]);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-8 text-graystone-500">
        <p className="text-sm">No activities logged yet.</p>
        <p className="text-xs mt-1">Use the quick log form to record your engagement.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((activity) => {
        const actionInfo = ACTION_TYPES.find((a) => a.value === activity.actionType);
        return (
          <div
            key={activity.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-white border border-graystone-200 hover:border-ocean-200 transition"
          >
            <div className="text-2xl">{actionInfo?.emoji || '📌'}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-ocean-900">{activity.accountHandle}</span>
                <Badge variant="outline" className="text-xs">
                  {activity.platform}
                </Badge>
                <span className="text-xs text-graystone-500">{actionInfo?.label}</span>
              </div>
              {activity.note && (
                <p className="text-sm text-graystone-600 mt-1 truncate">{activity.note}</p>
              )}
              <p className="text-xs text-graystone-400 mt-1">
                {new Date(activity.createdAt).toLocaleString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('Delete this activity?')) {
                  onDelete(activity.id);
                }
              }}
            >
              <TrashIcon className="w-4 h-4 text-graystone-400" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};

// Account Directory Component
const AccountDirectory: React.FC<{
  accounts: EngagementAccount[];
  onAdd: (account: Omit<EngagementAccount, 'id' | 'createdAt' | 'createdBy'>) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<EngagementAccount>) => void;
}> = ({ accounts, onAdd, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState(ALL_PLATFORMS[0]);
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState<EngagementAccountType>('Other');
  const [notes, setNotes] = useState('');
  const [filterType, setFilterType] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;

    onAdd({
      handle: handle.trim(),
      platform,
      displayName: displayName.trim() || undefined,
      accountType,
      notes: notes.trim() || undefined,
    });

    setHandle('');
    setDisplayName('');
    setNotes('');
    setShowForm(false);
  };

  const filtered = useMemo(() => {
    if (!filterType) return accounts;
    return accounts.filter((a) => a.accountType === filterType);
  }, [accounts, filterType]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-graystone-600">Filter by type</Label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={cx(selectBaseClasses, 'px-3 py-1 text-sm')}
          >
            <option value="">All types</option>
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Account
        </Button>
      </div>

      {showForm && (
        <Card className="shadow-md border-ocean-200">
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-graystone-600">Handle</Label>
                  <Input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="@username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-graystone-600">Platform</Label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className={cx(selectBaseClasses, 'w-full px-3 py-2 text-sm')}
                  >
                    {ALL_PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-graystone-600">Display Name</Label>
                  <Input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-graystone-600">Type</Label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as EngagementAccountType)}
                    className={cx(selectBaseClasses, 'w-full px-3 py-2 text-sm')}
                  >
                    {ACCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-graystone-600">Notes</Label>
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={!handle.trim()}>
                  Add Account
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-graystone-500">
          <p className="text-sm">No accounts in directory.</p>
          <p className="text-xs mt-1">Add accounts you engage with regularly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((account) => (
            <div
              key={account.id}
              className="p-4 rounded-xl bg-white border border-graystone-200 hover:border-ocean-200 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ocean-900">{account.handle}</span>
                    <Badge variant="outline" className="text-xs">
                      {account.platform}
                    </Badge>
                  </div>
                  {account.displayName && (
                    <p className="text-sm text-graystone-600">{account.displayName}</p>
                  )}
                  <div className="mt-2">
                    <span
                      className={cx(
                        'inline-block px-2 py-1 rounded-full text-xs font-medium',
                        ACCOUNT_TYPE_COLORS[account.accountType],
                      )}
                    >
                      {account.accountType}
                    </span>
                  </div>
                  {account.notes && (
                    <p className="text-xs text-graystone-500 mt-2">{account.notes}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Remove ${account.handle} from directory?`)) {
                      onDelete(account.id);
                    }
                  }}
                >
                  <TrashIcon className="w-4 h-4 text-graystone-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Progress Bar Component
const GoalProgressBar: React.FC<{
  label: string;
  emoji: string;
  current: number;
  target: number;
}> = ({ label, emoji, current, target }) => {
  const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const isComplete = current >= target;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1">
          <span>{emoji}</span>
          <span className="text-graystone-700">{label}</span>
        </span>
        <span className={cx('font-medium', isComplete ? 'text-emerald-600' : 'text-ocean-900')}>
          {current}/{target}
        </span>
      </div>
      <div className="h-2 bg-graystone-200 rounded-full overflow-hidden">
        <div
          className={cx(
            'h-full rounded-full transition-all duration-500',
            isComplete ? 'bg-emerald-500' : 'bg-ocean-500',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Goals Panel Component
const GoalsPanel: React.FC<{
  goals: EngagementGoals;
  activities: EngagementActivity[];
  onUpdateGoals: (goals: EngagementGoals) => void;
}> = ({ goals, activities, onUpdateGoals }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goals);

  // Calculate this week's counts
  const weekStart = useMemo(() => getWeekStart(goals.weekStartDay), [goals.weekStartDay]);
  const thisWeekCounts = useMemo(() => {
    const counts: Record<EngagementActionType, number> = {
      comment: 0,
      share: 0,
      reply: 0,
      like: 0,
      follow: 0,
      dm: 0,
    };

    activities.forEach((a) => {
      const activityDate = new Date(a.createdAt);
      if (activityDate >= weekStart) {
        counts[a.actionType]++;
      }
    });

    return counts;
  }, [activities, weekStart]);

  const handleSave = () => {
    onUpdateGoals(draft);
    setEditing(false);
  };

  const totalGoal =
    goals.weeklyComments +
    goals.weeklyShares +
    goals.weeklyReplies +
    goals.weeklyLikes +
    goals.weeklyFollows +
    goals.weeklyDms;

  const totalCurrent =
    thisWeekCounts.comment +
    thisWeekCounts.share +
    thisWeekCounts.reply +
    thisWeekCounts.like +
    thisWeekCounts.follow +
    thisWeekCounts.dm;

  const overallPercentage = totalGoal > 0 ? Math.min(100, (totalCurrent / totalGoal) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card className="shadow-xl border-2 border-ocean-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-ocean-900">Weekly Progress</h3>
              <p className="text-sm text-graystone-500">Week of {weekStart.toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-ocean-900">
                {Math.round(overallPercentage)}%
              </div>
              <div className="text-sm text-graystone-500">
                {totalCurrent}/{totalGoal} actions
              </div>
            </div>
          </div>
          <div className="h-4 bg-graystone-200 rounded-full overflow-hidden">
            <div
              className={cx(
                'h-full rounded-full transition-all duration-500',
                overallPercentage >= 100
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-ocean-400 to-ocean-600',
              )}
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Individual Goals */}
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-ocean-900">Goal Breakdown</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : 'Edit Goals'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {ACTION_TYPES.map((action) => {
                  const _key =
                    `weekly${action.label.replace(/[^a-zA-Z]/g, '')}s` as keyof EngagementGoals;
                  const goalKey =
                    action.value === 'comment'
                      ? 'weeklyComments'
                      : action.value === 'share'
                        ? 'weeklyShares'
                        : action.value === 'reply'
                          ? 'weeklyReplies'
                          : action.value === 'like'
                            ? 'weeklyLikes'
                            : action.value === 'follow'
                              ? 'weeklyFollows'
                              : 'weeklyDms';

                  return (
                    <div key={action.value} className="space-y-1">
                      <Label className="text-xs text-graystone-600">
                        {action.emoji} {action.label}s/week
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={draft[goalKey]}
                        onChange={(e) =>
                          setDraft({ ...draft, [goalKey]: parseInt(e.target.value) || 0 })
                        }
                        className="w-full"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-graystone-600">Week starts on</Label>
                <select
                  value={draft.weekStartDay}
                  onChange={(e) =>
                    setDraft({ ...draft, weekStartDay: e.target.value as 'monday' | 'sunday' })
                  }
                  className={cx(selectBaseClasses, 'px-3 py-2 text-sm')}
                >
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>
              <Button onClick={handleSave}>Save Goals</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <GoalProgressBar
                label="Comments"
                emoji="💬"
                current={thisWeekCounts.comment}
                target={goals.weeklyComments}
              />
              <GoalProgressBar
                label="Shares"
                emoji="🔄"
                current={thisWeekCounts.share}
                target={goals.weeklyShares}
              />
              <GoalProgressBar
                label="Replies"
                emoji="↩️"
                current={thisWeekCounts.reply}
                target={goals.weeklyReplies}
              />
              <GoalProgressBar
                label="Likes"
                emoji="❤️"
                current={thisWeekCounts.like}
                target={goals.weeklyLikes}
              />
              <GoalProgressBar
                label="Follows"
                emoji="➕"
                current={thisWeekCounts.follow}
                target={goals.weeklyFollows}
              />
              <GoalProgressBar
                label="DMs"
                emoji="✉️"
                current={thisWeekCounts.dm}
                target={goals.weeklyDms}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Main Engagement View
export const EngagementView: React.FC<EngagementViewProps> = ({
  activities,
  accounts,
  goals,
  onAddActivity,
  onDeleteActivity,
  onAddAccount,
  onDeleteAccount,
  onUpdateAccount,
  onUpdateGoals,
}) => {
  const [activeTab, setActiveTab] = useState<'log' | 'directory' | 'goals'>('log');
  const [platformFilter, setPlatformFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Sort activities by date (newest first)
  const sortedActivities = useMemo(
    () =>
      [...activities].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [activities],
  );

  // Sort accounts alphabetically
  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.handle.localeCompare(b.handle)),
    [accounts],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header rounded-2xl p-8 text-white shadow-xl">
        <h1 className="heading-font text-3xl font-bold mb-2">Engagement</h1>
        <p className="text-ocean-100">
          Track your proactive engagement with other accounts across platforms.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'log' ? 'default' : 'outline'}
          onClick={() => setActiveTab('log')}
        >
          Activity Log
        </Button>
        <Button
          variant={activeTab === 'goals' ? 'default' : 'outline'}
          onClick={() => setActiveTab('goals')}
        >
          Goals
        </Button>
        <Button
          variant={activeTab === 'directory' ? 'default' : 'outline'}
          onClick={() => setActiveTab('directory')}
        >
          Account Directory
        </Button>
      </div>

      {/* Log Tab */}
      {activeTab === 'log' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <QuickLogForm accounts={sortedAccounts} onSubmit={onAddActivity} />
          </div>
          <div className="lg:col-span-2">
            <Card className="shadow-xl">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-xl text-ocean-900">Recent Activity</CardTitle>
                  <div className="flex gap-2">
                    <select
                      value={platformFilter}
                      onChange={(e) => setPlatformFilter(e.target.value)}
                      className={cx(selectBaseClasses, 'px-3 py-1 text-xs')}
                    >
                      <option value="">All platforms</option>
                      {ALL_PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <select
                      value={actionFilter}
                      onChange={(e) => setActionFilter(e.target.value)}
                      className={cx(selectBaseClasses, 'px-3 py-1 text-xs')}
                    >
                      <option value="">All actions</option>
                      {ACTION_TYPES.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ActivityList
                  activities={sortedActivities}
                  onDelete={onDeleteActivity}
                  platformFilter={platformFilter}
                  actionFilter={actionFilter}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <GoalsPanel goals={goals} activities={activities} onUpdateGoals={onUpdateGoals} />
      )}

      {/* Directory Tab */}
      {activeTab === 'directory' && (
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-ocean-900">Account Directory</CardTitle>
            <p className="text-sm text-graystone-500">
              Accounts you engage with regularly across platforms
            </p>
          </CardHeader>
          <CardContent>
            <AccountDirectory
              accounts={sortedAccounts}
              onAdd={onAddAccount}
              onDelete={onDeleteAccount}
              onUpdate={onUpdateAccount}
            />
          </CardContent>
        </Card>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-md">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-ocean-900">{activities.length}</div>
            <div className="text-xs text-graystone-500">Total Activities</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-ocean-900">{accounts.length}</div>
            <div className="text-xs text-graystone-500">Accounts Tracked</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-ocean-900">
              {
                activities.filter((a) => {
                  const date = new Date(a.createdAt);
                  const now = new Date();
                  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  return date >= weekAgo;
                }).length
              }
            </div>
            <div className="text-xs text-graystone-500">This Week</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-ocean-900">
              {new Set(activities.map((a) => a.platform)).size}
            </div>
            <div className="text-xs text-graystone-500">Platforms Active</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EngagementView;
