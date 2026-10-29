import { ReviewToastProvider } from '../_components/review/ReviewToast';

/** Keeps the toast alive while the editor hands over to the detail after „Odeslat ke kontrole“. */
export default function ScriptsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ReviewToastProvider>{children}</ReviewToastProvider>;
}
