import React, { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Button,
  Input,
  Textarea,
  Label,
  MultiSelect,
} from '../../components/ui';
import { PlusIcon } from '../../components/common';
import { AUDIENCE_SEGMENTS } from '../../constants';
import type { ContentRequestPayload } from '../../hooks/domain/useContentRequests';

export interface ContentRequestFormProps {
  onSubmit: (payload: ContentRequestPayload) => void;
  currentUser: string | null;
  approverOptions: string[];
}

export function ContentRequestForm({
  onSubmit,
  currentUser,
  approverOptions,
}: ContentRequestFormProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [keyMessages, setKeyMessages] = useState('');
  const [assetsNeeded, setAssetsNeeded] = useState('');
  const [audienceSegments, setAudienceSegments] = useState<string[]>([]);
  const [approvers, setApprovers] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setTitle('');
    setKeyMessages('');
    setAssetsNeeded('');
    setAudienceSegments([]);
    setApprovers([]);
    setDeadline('');
    setNotes('');
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      window.alert('Please add a request title.');
      return;
    }

    onSubmit({
      title: title.trim(),
      keyMessages: keyMessages.trim(),
      assetsNeeded: assetsNeeded.trim(),
      audienceSegments,
      approvers,
      deadline: deadline || undefined,
      notes: notes.trim(),
    });

    reset();
  };

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl text-ocean-900">Submit Content Request</CardTitle>
        <p className="text-sm text-graystone-500">
          Use this brief to request content from the team. Fran reviews requests and converts them
          into calendar entries.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Request title</Label>
              <Input
                value={title}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
                placeholder="Campaign update for supporters"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Requested by</Label>
              <Input value={currentUser || 'Unknown'} readOnly className="bg-graystone-100" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Key messages</Label>
            <Textarea
              value={keyMessages}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setKeyMessages(event.target.value)
              }
              rows={4}
              placeholder="What must this content communicate?"
            />
          </div>

          <div className="space-y-2">
            <Label>Images / assets needed</Label>
            <Textarea
              value={assetsNeeded}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setAssetsNeeded(event.target.value)
              }
              rows={3}
              placeholder="Photo, infographic, animation, case study quote card..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Audience segments</Label>
              <MultiSelect
                placeholder="Select audience segments"
                value={audienceSegments}
                onChange={setAudienceSegments}
                options={AUDIENCE_SEGMENTS.map((segment) => ({ value: segment, label: segment }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Approvers</Label>
              <MultiSelect
                placeholder="Select approvers"
                value={approvers}
                onChange={setApprovers}
                options={approverOptions.map((name) => ({ value: name, label: name }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Deadline</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setDeadline(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Any other notes</Label>
            <Textarea
              value={notes}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)}
              rows={3}
              placeholder="Dependencies, links, legal checks, partner context..."
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" className="gap-2">
              <PlusIcon className="h-4 w-4 text-white" />
              Submit request
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

export default ContentRequestForm;
