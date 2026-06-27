import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface FeatureNoticeItem {
  id: string;
  title: string;
  children: ReactNode;
}

interface FeatureNoticeProps extends FeatureNoticeItem {
  dismissLabel: string;
}

interface FeatureNoticeGroupProps {
  notices: FeatureNoticeItem[];
  dismissLabel: string;
}

interface NoticeCardProps extends FeatureNoticeProps {
  onDismiss: () => void;
}

const storageKey = (id: string) => `wc2026-seen-feature-${id}`;

function readDismissed(id: string): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(storageKey(id)) === 'true';
}

function markDismissed(id: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey(id), 'true');
  }
}

function firstUnseenIndex(notices: FeatureNoticeItem[]): number {
  return notices.findIndex((notice) => !readDismissed(notice.id));
}

function NoticeCard({
  id: _id,
  title,
  children,
  dismissLabel,
  onDismiss,
}: NoticeCardProps) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-lg border border-blue-200 bg-white p-4 shadow-xl dark:border-blue-900/70 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h2>
          <div className="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-300">
            {children}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          aria-label={dismissLabel}
        >
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}

export function FeatureNotice({ id, ...props }: FeatureNoticeProps) {
  const [dismissed, setDismissed] = useState(() => readDismissed(id));

  const dismiss = () => {
    markDismissed(id);
    setDismissed(true);
  };

  if (dismissed) return null;
  return <NoticeCard id={id} {...props} onDismiss={dismiss} />;
}

export function FeatureNoticeGroup({ notices, dismissLabel }: FeatureNoticeGroupProps) {
  const [activeIndex, setActiveIndex] = useState(() => firstUnseenIndex(notices));

  useEffect(() => {
    setActiveIndex(firstUnseenIndex(notices));
  }, [notices]);

  if (activeIndex === -1) return null;

  const active = notices[activeIndex];
  const dismiss = () => {
    markDismissed(active.id);
    const nextIndex = notices.findIndex((notice, index) => index > activeIndex && !readDismissed(notice.id));
    setActiveIndex(nextIndex);
  };

  return (
    <NoticeCard
      {...active}
      dismissLabel={dismissLabel}
      onDismiss={dismiss}
    />
  );
}
