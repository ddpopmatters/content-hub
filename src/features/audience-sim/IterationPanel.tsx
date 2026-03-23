import { Button } from '../../components/ui';
import type { DiffChunk } from './types';

export interface IterationPanelProps {
  diff: DiffChunk[];
  onAccept: () => void;
  onReject: () => void;
}

const chunkClasses: Record<DiffChunk['type'], string> = {
  keep: 'text-graystone-800',
  remove: 'text-rose-700 line-through decoration-rose-400',
  add: 'text-emerald-700 underline decoration-emerald-400 decoration-2 underline-offset-2',
};

export function IterationPanel({ diff, onAccept, onReject }: IterationPanelProps) {
  return (
    <div className="space-y-4 rounded-3xl border border-graystone-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-base font-semibold text-ocean-900">Claude iteration diff</h3>
        <p className="mt-1 text-sm text-graystone-500">
          Review the suggested changes before accepting the revision.
        </p>
      </div>

      <div className="rounded-2xl border border-graystone-100 bg-graystone-50 p-4 text-sm leading-7 whitespace-pre-wrap">
        {diff.map((chunk, index) => (
          <span key={`${chunk.type}-${index}`}>
            <span className={chunkClasses[chunk.type]}>{chunk.text}</span>
            {chunk.reason ? (
              <span className="block text-xs italic text-graystone-500">{chunk.reason}</span>
            ) : null}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onAccept} className="bg-ocean-600 hover:bg-ocean-700">
          Accept
        </Button>
        <Button type="button" variant="outline" onClick={onReject}>
          Reject
        </Button>
      </div>
    </div>
  );
}

export default IterationPanel;
