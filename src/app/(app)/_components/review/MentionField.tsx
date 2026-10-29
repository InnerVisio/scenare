'use client';

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref, type TextareaHTMLAttributes } from 'react';
import { cn, focusRing } from '@/ui/cn';
import { activeMention, matchMentionUsers } from './model';

interface UserOption {
  id: string;
  name: string;
}

/** Growing textarea; typing „@“ offers the people who can be mentioned and inserts `@Jméno`. */
export function MentionField({
  value,
  onChange,
  users,
  onSubmitShortcut,
  inputRef,
  className,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  users: UserOption[];
  /** Ctrl/⌘ + Enter. */
  onSubmitShortcut?: () => void;
  inputRef?: Ref<HTMLTextAreaElement>;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const own = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);

  const mention = activeMention(value, caret);
  const options = mention && dismissed !== mention.start ? matchMentionUsers(users, mention.query) : [];

  // Grow with the text. Also re-measure when the field becomes visible or changes width (it starts
  // inside a hidden, collapsed sheet where nothing can be measured).
  useLayoutEffect(() => {
    const el = own.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      if (el.scrollHeight > 0) el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  function pick(user: UserOption) {
    if (!mention) return;
    const inserted = `@${user.name} `;
    const next = value.slice(0, mention.start) + inserted + value.slice(caret);
    onChange(next);
    const position = mention.start + inserted.length;
    setCaret(position);
    requestAnimationFrame(() => {
      own.current?.focus();
      own.current?.setSelectionRange(position, position);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmitShortcut?.();
    } else if (event.key === 'Escape' && options.length > 0 && mention) {
      event.stopPropagation();
      setDismissed(mention.start);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      {options.length > 0 && (
        <ul
          role="listbox"
          aria-label="Zmínit"
          className="absolute bottom-full left-0 z-10 mb-2 max-h-48 w-56 overflow-y-auto rounded-inner bg-card p-1.5 shadow-[0_12px_32px_rgba(23,21,31,0.2)]"
        >
          {options.map((user) => (
            <li key={user.id} role="option" aria-selected={false}>
              <button
                type="button"
                // Keep the textarea focused.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(user)}
                className={cn('flex min-h-12 w-full items-center rounded-xl px-3 text-left font-semibold hover:bg-nest', focusRing)}
              >
                @{user.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        {...rest}
        ref={(el) => {
          own.current = el;
          if (typeof inputRef === 'function') inputRef(el);
          else if (inputRef) (inputRef as { current: HTMLTextAreaElement | null }).current = el;
        }}
        value={value}
        rows={rest.rows ?? 1}
        onChange={(event) => {
          setCaret(event.target.selectionStart);
          setDismissed(null);
          onChange(event.target.value);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        className={cn('block w-full resize-none bg-transparent px-1 py-3 text-base leading-6 outline-none placeholder:text-text2', className)}
      />
    </div>
  );
}
