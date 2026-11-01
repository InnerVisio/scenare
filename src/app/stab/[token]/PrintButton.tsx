'use client';

import { Button } from '@/ui/Button';

/** „Tisk / uložit PDF“: the browser's print dialog (hidden on paper). */
export function PrintButton() {
  return (
    <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
      Tisk / uložit PDF
    </Button>
  );
}
