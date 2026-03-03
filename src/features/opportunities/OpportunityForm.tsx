import React, { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Button,
  Input,
  Textarea,
  Label,
} from '../../components/ui';
import { PlusIcon } from '../../components/common';
import { cx } from '../../lib/utils';
import { selectBaseClasses } from '../../lib/styles';
import type { Entry, OpportunityUrgency } from '../../types/models';

export interface OpportunityPayload {
  date: string;
  description: string;
  angle: string;
  urgency: OpportunityUrgency;
  linkedEntryId?: string;
}

export interface OpportunityFormProps {
  onSubmit: (payload: OpportunityPayload) => void;
  currentUser: string | null;
  entries: Entry[];
}

const DEFAULT_URGENCY: OpportunityUrgency = 'Medium';

export function OpportunityForm({
  onSubmit,
  currentUser,
  entries,
}: OpportunityFormProps): React.ReactElement {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [angle, setAngle] = useState('');
  const [urgency, setUrgency] = useState<OpportunityUrgency>(DEFAULT_URGENCY);
  const [linkedEntryId, setLinkedEntryId] = useState('');

  const linkedEntryOptions = useMemo(() => {
    return entries
      .filter((entry) => !entry.deletedAt)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries]);

  const reset = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setDescription('');
    setAngle('');
    setUrgency(DEFAULT_URGENCY);
    setLinkedEntryId('');
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!date) {
      window.alert('Please add the opportunity date.');
      return;
    }
    if (!description.trim()) {
      window.alert('Please add a short description.');
      return;
    }

    onSubmit({
      date,
      description: description.trim(),
      angle: angle.trim(),
      urgency,
      linkedEntryId: linkedEntryId || undefined,
    });

    reset();
  };

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl text-ocean-900">Log an Opportunity</CardTitle>
        <p className="text-sm text-graystone-500">
          Capture reactive moments so they can be reviewed in weekly planning.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Logged by</Label>
              <Input value={currentUser || 'Unknown'} readOnly className="bg-graystone-100" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(event.target.value)
              }
              rows={4}
              placeholder="What happened? Include the key signal worth reacting to."
              required
            />
          </div>

          <div className="space-y-2">
            <Label>PM angle</Label>
            <Textarea
              value={angle}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setAngle(event.target.value)}
              rows={3}
              placeholder="What could PM's take be?"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Urgency</Label>
              <select
                value={urgency}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setUrgency(event.target.value as OpportunityUrgency)
                }
                className={cx(selectBaseClasses, 'w-full')}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Linked entry (optional)</Label>
              <select
                value={linkedEntryId}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setLinkedEntryId(event.target.value)
                }
                className={cx(selectBaseClasses, 'w-full')}
              >
                <option value="">None</option>
                {linkedEntryOptions.map((entry) => {
                  const label = `${entry.date} - ${entry.caption || entry.assetType || 'Untitled'}`;
                  return (
                    <option key={entry.id} value={entry.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" className="gap-2">
              <PlusIcon className="h-4 w-4 text-white" />
              Log opportunity
            </Button>
            <Button type="button" variant="outline" onClick={reset}>
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default OpportunityForm;
