'use client';

import { useMemo } from 'react';
import { runChecks } from '@/domain/checks/runChecks';
import type { ScriptBody } from '@/domain/script/types';
import type { EditorValues, ScriptPageData } from '@/server/scripts';
import { ChecksPanel } from '../review/ChecksPanel';

const NO_PERMS = {
  decide: false,
  comment: false,
  suggest: false,
  flagNumber: false,
  confirmNumber: false,
  close: false,
  reopen: false,
  address: false,
  decideSuggestion: false,
  manualCheck: false,
};

const noop = async () => false;

/** Task 6 checks run in the browser on the draft as it is typed; same list as in the review screen. */
export function useLiveChecks(body: ScriptBody, values: EditorValues, data: ScriptPageData) {
  const { checkInput, numberChecks } = data;
  return useMemo(
    () =>
      runChecks(
        {
          body,
          goalMetric: values.goalMetric,
          isSeriesEpisode: values.seriesId !== null,
          formatStatus: values.formatKey ? (checkInput.formatStatuses[values.formatKey] ?? 'untested') : null,
          isTrialReel: values.isTrialReel,
          numberChecks,
          personHashtags: checkInput.personHashtags,
          manualChecks: checkInput.manualChecks,
        },
        checkInput.rules,
      ),
    [body, values.goalMetric, values.seriesId, values.formatKey, values.isTrialReel, numberChecks, checkInput],
  );
}

export function LiveChecks({ checks, numberChecks }: { checks: ReturnType<typeof useLiveChecks>; numberChecks: ScriptPageData['numberChecks'] }) {
  return <ChecksPanel checks={checks} numberChecks={numberChecks} perms={NO_PERMS} onToggleManual={noop} onConfirmNumber={noop} hideEmptyNumbers />;
}
