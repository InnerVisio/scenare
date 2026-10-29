import { ReviewToastProvider } from '../_components/review/ReviewToast';

/** Keeps the toast alive while the review moves from one script to the next. */
export default function ReviewLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ReviewToastProvider>{children}</ReviewToastProvider>;
}
