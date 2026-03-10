import React from 'react';
import { MultiSelect } from '../../components/ui';
import { DEFAULT_APPROVERS } from '../../constants';

export interface ApproverMultiProps {
  /** Currently selected approvers */
  value: string[];
  /** Callback when selection changes */
  onChange: (value: string[]) => void;
  /** Available approver options */
  options?: readonly string[];
  /** Optional button id for label association */
  buttonId?: string;
  /** Optional accessible label reference */
  labelledBy?: string;
}

/**
 * ApproverMulti - Multi-select dropdown for choosing approvers
 */
export const ApproverMulti: React.FC<ApproverMultiProps> = ({
  value,
  onChange,
  options = DEFAULT_APPROVERS,
  buttonId,
  labelledBy,
}) => (
  <MultiSelect
    placeholder="Select approvers"
    value={value}
    onChange={onChange}
    buttonId={buttonId}
    labelledBy={labelledBy}
    options={options.map((name) => ({
      value: name,
      label: name,
    }))}
  />
);

export default ApproverMulti;
