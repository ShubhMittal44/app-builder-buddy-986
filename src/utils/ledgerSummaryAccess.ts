export interface SummaryIdentity {
  userId: string | undefined;
  profileUserId: string | undefined;
  role: string | undefined;
  active: boolean | undefined;
  loading: boolean;
}

export function canRequestLedgerSummary(identity: SummaryIdentity) {
  return !identity.loading && !!identity.userId && identity.userId === identity.profileUserId
    && identity.role === 'admin' && identity.active !== false;
}

export async function requestLedgerSummary<T>(identity: SummaryIdentity, request: () => Promise<T>): Promise<T | null> {
  if (!canRequestLedgerSummary(identity)) return null;
  return request();
}