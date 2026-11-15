'use client';

import { useState, useTransition } from 'react';
import { parseScriptsAction } from '@/app/(app)/scenare/actions';
import type { ParsedScript } from '@/server/scriptImport';
import { Button } from '@/ui/Button';
import { Field, Textarea } from '@/ui/Field';
import { ReviewDialog } from '../review/ReviewDialog';

/** „Vložit text znovu“: paste, split, confirm, then the draft body is replaced. */
export function PasteDialog({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (script: ParsedScript) => void }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setParsed(null);
    setError(null);
    onClose();
  };
  const split = () =>
    start(async () => {
      setError(null);
      const result = await parseScriptsAction({ text });
      if (!result.ok) return setError(result.message);
      const [first] = result.scripts;
      if (!first) return setError('Nic jsem nenašel.');
      setParsed(result.scripts.length > 1 ? { ...first, warnings: ['Vložených scénářů je víc, použil jsem první.', ...first.warnings] } : first);
    });

  return (
    <ReviewDialog open={open} onClose={close} title={parsed ? 'Nahradit obsah scénáře?' : 'Vložit text znovu'}>
      <div className="flex flex-col gap-4">
        {parsed ? (
          <>
            <p>
              Rozdělil jsem {parsed.body.hooks.length} hooků a {parsed.body.scenes.length} scén. Současný obsah scénáře (hooky, scény, popisek) se nahradí.
            </p>
            {parsed.warnings.length > 0 && (
              <ul className="flex list-disc flex-col gap-1 rounded-inner bg-apricot-soft p-4 pl-9 text-apricot-ink">
                {parsed.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  onApply(parsed);
                  setText('');
                  close();
                }}
              >
                Nahradit
              </Button>
              <Button variant="outline" onClick={() => setParsed(null)}>
                Zpět k textu
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field label="Vlož celý text scénáře">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-56" maxLength={20000} />
            </Field>
            {error && (
              <p role="alert" className="font-semibold text-danger-text">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" pending={pending} disabled={pending || text.trim().length < 20} onClick={split}>
                Rozdělit scénář
              </Button>
              <Button variant="outline" onClick={close}>
                Zrušit
              </Button>
            </div>
          </>
        )}
      </div>
    </ReviewDialog>
  );
}
