'use client';

import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { cn, focusRing } from '@/ui/cn';

/**
 * Tags typed one after another: Enter, space or comma adds them (Backspace on an empty field removes
 * the last). `add` turns the typed text into the new list, so each use decides how to normalise.
 */
export function ChipInput({
  label,
  tags,
  onChange,
  add,
  placeholder,
  suggestions,
  hint,
  splitOnSpace = true,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  add: (tags: string[], typed: string) => string[];
  placeholder?: string;
  suggestions?: string[];
  hint?: string;
  /** Hashtags end at a space; names such as „Petr (klient)“ only at a comma. */
  splitOnSpace?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const listId = useId();

  function commit(text: string) {
    if (text.trim()) onChange(add(tags, text));
    setTyped('');
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-sm font-semibold text-text2" htmlFor={`${listId}-input`}>
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-inner bg-nest p-2">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex min-h-10 items-center gap-1 rounded-pill bg-violet-soft pr-1 pl-3 font-semibold text-violet-ink">
            {tag}
            <button
              type="button"
              aria-label={`Odebrat ${tag}`}
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className={cn('flex size-10 items-center justify-center rounded-full hover:bg-ink/10', focusRing)}
            >
              <X aria-hidden className="size-4" />
            </button>
          </span>
        ))}
        <input
          id={`${listId}-input`}
          value={typed}
          list={suggestions ? `${listId}-list` : undefined}
          placeholder={tags.length === 0 ? placeholder : undefined}
          onChange={(event) => {
            const text = event.target.value;
            // A separator ends a tag, also when pasted inside a longer text.
            if ((splitOnSpace ? /[\s,]/ : /,/).test(text.trimStart()) && text.trim() !== '') commit(text);
            else setTyped(text.trim() === '' ? '' : text);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(typed);
            } else if (event.key === 'Backspace' && typed === '' && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => commit(typed)}
          className={cn('min-h-10 min-w-32 flex-1 bg-transparent px-2 text-ink placeholder:text-text2/70', focusRing, 'rounded-lg')}
        />
        {suggestions && (
          <datalist id={`${listId}-list`}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>
      {hint && <p className="text-sm text-text2">{hint}</p>}
    </div>
  );
}
