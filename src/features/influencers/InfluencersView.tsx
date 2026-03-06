import React, { useState, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Button,
  Badge,
  Label,
} from '../../components/ui';
import { PlusIcon } from '../../components/common';
import { cx } from '../../lib/utils';
import { selectBaseClasses } from '../../lib/styles';
import { ALL_PLATFORMS, INFLUENCER_STATUSES, INFLUENCER_STATUS_COLORS } from '../../constants';
import type { Influencer, Entry } from '../../types/models';

export interface InfluencersViewProps {
  influencers: Influencer[];
  entries: Entry[];
  currentUser: string;
  onAdd: (influencer: Omit<Influencer, 'id' | 'createdAt' | 'createdBy'>) => void;
  onUpdate: (influencer: Influencer) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (id: string) => void;
}

export const InfluencersView: React.FC<InfluencersViewProps> = ({
  influencers,
  entries,
  currentUser: _currentUser,
  onAdd: _onAdd,
  onUpdate: _onUpdate,
  onDelete: _onDelete,
  onOpenDetail,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPlatform, setFilterPlatform] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'followers' | 'status' | 'niche' | 'createdAt'>(
    'createdAt',
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Helper to get all platforms for an influencer (from platformProfiles or legacy field)
  const getInfluencerPlatforms = (influencer: Influencer): string[] => {
    if (influencer.platformProfiles && influencer.platformProfiles.length > 0) {
      return influencer.platformProfiles.map((p) => p.platform);
    }
    return influencer.platform ? [influencer.platform] : [];
  };

  const filtered = useMemo(() => {
    let result = [...influencers];

    if (filterStatus !== 'All') {
      result = result.filter((i) => i.status === filterStatus);
    }
    if (filterPlatform !== 'All') {
      // Filter by any platform in platformProfiles or legacy field
      result = result.filter((i) => {
        const platforms = getInfluencerPlatforms(i);
        return platforms.includes(filterPlatform);
      });
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'followers':
          cmp = (a.followerCount || 0) - (b.followerCount || 0);
          break;
        case 'status':
          cmp =
            INFLUENCER_STATUSES.indexOf(a.status as any) -
            INFLUENCER_STATUSES.indexOf(b.status as any);
          break;
        case 'niche':
          cmp = (a.niche || '').localeCompare(b.niche || '');
          break;
        case 'createdAt':
        default:
          cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [influencers, filterStatus, filterPlatform, sortBy, sortDir]);

  const getLinkedEntryCount = (influencerId: string) =>
    entries.filter((e) => e.influencerId === influencerId).length;

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const formatFollowers = (count: number) => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl text-ocean-900">Influencer Pipeline</CardTitle>
            <p className="text-sm text-graystone-500">
              Track partnership opportunities from discovery to collaboration.
            </p>
          </div>
          <Button onClick={() => onOpenDetail('new')}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Influencer
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-graystone-500">Status</Label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={cx(selectBaseClasses, 'px-3 py-1.5 text-sm')}
            >
              <option value="All">All statuses</option>
              {INFLUENCER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-graystone-500">Platform</Label>
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className={cx(selectBaseClasses, 'px-3 py-1.5 text-sm')}
            >
              <option value="All">All platforms</option>
              {ALL_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-graystone-200">
          <table className="w-full text-sm">
            <thead className="bg-graystone-50 text-left text-xs uppercase text-graystone-500">
              <tr>
                <th
                  className="cursor-pointer px-4 py-3 hover:bg-graystone-100"
                  onClick={() => handleSort('name')}
                >
                  Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3">Platforms</th>
                <th
                  className="cursor-pointer px-4 py-3 hover:bg-graystone-100"
                  onClick={() => handleSort('followers')}
                >
                  Followers {sortBy === 'followers' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 hover:bg-graystone-100"
                  onClick={() => handleSort('status')}
                >
                  Status {sortBy === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 hover:bg-graystone-100"
                  onClick={() => handleSort('niche')}
                >
                  Niche {sortBy === 'niche' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3">Linked Posts</th>
                <th className="px-4 py-3">Est. Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graystone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-graystone-500">
                    No influencers found. Add your first one to get started.
                  </td>
                </tr>
              ) : (
                filtered.map((influencer) => {
                  const profiles =
                    influencer.platformProfiles && influencer.platformProfiles.length > 0
                      ? influencer.platformProfiles
                      : [
                          {
                            platform: influencer.platform,
                            handle: influencer.handle,
                            profileUrl: influencer.profileUrl,
                          },
                        ];
                  return (
                    <tr
                      key={influencer.id}
                      className="cursor-pointer hover:bg-graystone-50"
                      onClick={() => onOpenDetail(influencer.id)}
                    >
                      <td className="px-4 py-3 font-medium text-ocean-900">{influencer.name}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {profiles.map((p, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-medium">{p.platform}</span>
                              {p.handle && (
                                <span className="ml-1 text-graystone-500">{p.handle}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">{formatFollowers(influencer.followerCount)}</td>
                      <td className="px-4 py-3">
                        <Badge className={INFLUENCER_STATUS_COLORS[influencer.status]}>
                          {influencer.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-graystone-600">{influencer.niche || '—'}</td>
                      <td className="px-4 py-3">{getLinkedEntryCount(influencer.id)}</td>
                      <td className="px-4 py-3">
                        {influencer.estimatedRate ? `£${influencer.estimatedRate}` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
