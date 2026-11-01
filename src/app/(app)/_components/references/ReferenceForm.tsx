'use client';

import { useState, useTransition } from 'react';
import { MAX_REFERENCE_NOTE, MAX_REFERENCE_URL } from '@/domain/references';
import { Button } from '@/ui/Button';
import { Field, Select, TextInput } from '@/ui/Field';
import { addReferenceAction } from '../../scenare/actions';

/** Add a sample to the whole video or to one scene (`sceneId` preselects it, e.g. from „+ ukázka“). */
export function ReferenceForm({
  videoId,
  scenes,
  sceneId,
  onSceneChange,
  disabled = false,
}: {
  videoId: string;
  scenes: { id: string; label: string }[];
  sceneId: string;
  onSceneChange: (sceneId: string) => void;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await addReferenceAction({ videoId, url, note, sceneId: sceneId || null });
      if (!result.ok) return setError(result.message);
      setUrl('');
      setNote('');
    });
  };

  return (
    <form noValidate onSubmit={submit} aria-label="Přidat ukázku" className="flex flex-col gap-3">
      <Field label="Odkaz na ukázku" hint="TikTok, Instagram, YouTube…">
        <TextInput
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          maxLength={MAX_REFERENCE_URL}
          onChange={(event) => setUrl(event.target.value)}
        />
      </Field>
      <Field label="Poznámka (co si z ní vzít)">
        <TextInput value={note} maxLength={MAX_REFERENCE_NOTE} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Field label="Ke které části">
        <Select value={sceneId} onChange={(event) => onSceneChange(event.target.value)}>
          <option value="">Celé video</option>
          {scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.label}
            </option>
          ))}
        </Select>
      </Field>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-text">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full sm:w-fit" pending={pending} disabled={disabled || url.trim() === ''}>
        Přidat ukázku
      </Button>
    </form>
  );
}
