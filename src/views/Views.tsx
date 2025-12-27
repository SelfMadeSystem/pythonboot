import { XTerminal } from '../xterm/XTerminal';
import { type ViewsTab, ViewsTabs } from './ViewsTabs';
import { TurtleCanvas } from '@/turtle/TurtleCanvas';
import clsx from 'clsx';
import { useState } from 'react';
import type { Terminal } from 'xterm';

export function Views({
  split,
  outTermRef,
}: {
  split: number;
  outTermRef: React.RefObject<Terminal | null>;
}) {
  const [activeTab, setActiveTab] = useState<ViewsTab>('output');
  return (
    <div className="flex h-full flex-col">
      <ViewsTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="relative h-[calc(100%-40.75px)] w-full">
        <div
          className={clsx(activeTab === 'output' || 'hidden', 'h-full w-full')}
        >
          <XTerminal split={split} xtermRef={outTermRef} />
        </div>
        <div
          className={clsx(
            activeTab === 'turtle' || 'invisible',
            'absolute inset-0 overflow-hidden',
          )}
        >
          <TurtleCanvas />
        </div>
      </div>
    </div>
  );
}
