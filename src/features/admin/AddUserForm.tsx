import React, { useState, type ChangeEvent } from 'react';
import { Button, Input } from '../../components/ui';
import { cx } from '../../lib/utils';
import { FEATURE_OPTIONS } from '../../constants';
import { DEFAULT_FEATURES } from '../../lib/users';

export interface AddUserFormData {
  first: string;
  last: string;
  email: string;
  features: string[];
  isApprover: boolean;
}

export interface AddUserFormProps {
  defaultFeatures?: string[];
  onSubmit: (data: AddUserFormData) => void;
  error: string;
  success: string;
}

export function AddUserForm({
  defaultFeatures = DEFAULT_FEATURES,
  onSubmit,
  error,
  success,
}: AddUserFormProps): React.ReactElement {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [features, setFeatures] = useState<string[]>(() => [...defaultFeatures]);
  const [isApprover, setIsApprover] = useState(false);

  const toggleFeature = (key: string) => {
    setFeatures((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const handleSubmit = () => {
    onSubmit({ first, last, email, features, isApprover });
    setFirst('');
    setLast('');
    setEmail('');
    setFeatures([...defaultFeatures]);
    setIsApprover(false);
  };

  return (
    <>
      {error ? (
        <div className="mb-3 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="mb-3 rounded-2xl bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
          {success}
        </div>
      ) : null}
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <Input
          placeholder="First name"
          value={first}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setFirst(event.target.value)}
          className="px-3 py-2"
        />
        <Input
          placeholder="Last name"
          value={last}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setLast(event.target.value)}
          className="px-3 py-2"
        />
        <Input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
          className="px-3 py-2"
        />
      </div>
      <div className="mt-3">
        <div className="text-xs font-semibold text-graystone-600">Grant access to</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {FEATURE_OPTIONS.map((option) => {
            const enabled = features.includes(option.key);
            return (
              <label
                key={option.key}
                className={cx(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                  enabled
                    ? 'border-aqua-200 bg-aqua-100 text-ocean-700'
                    : 'border-graystone-200 bg-white text-graystone-600 hover:border-graystone-400',
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-graystone-300 text-aqua-500 focus:ring-aqua-300"
                  checked={enabled}
                  onChange={() => toggleFeature(option.key)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-graystone-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-graystone-300 text-aqua-500 focus:ring-aqua-300"
            checked={isApprover}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setIsApprover(event.target.checked)}
          />
          Approver
        </label>
        <span className="text-[11px] text-graystone-500">
          Approvers appear in the approvals picker and receive notifications.
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button onClick={handleSubmit} disabled={!first.trim() || !last.trim() || !email.trim()}>
          Add user
        </Button>
      </div>
    </>
  );
}

export default AddUserForm;
