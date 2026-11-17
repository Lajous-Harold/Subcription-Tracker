import type {
  AcceptCandidateBody,
  BankAccount,
  BankAccountListResponse,
  BankLink,
  BankLinkResponse,
  CandidateListResponse,
  CandidateStatus,
  CompleteConnectSessionBody,
  ConnectSessionResponse,
  CreateConnectSessionBody,
  CreatePaymentBody,
  CreateSubscriptionBody,
  DashboardSummary,
  DemoDataResponse,
  DetectionRunResponse,
  Payment,
  PaymentListResponse,
  Provider,
  ProviderListResponse,
  ResettableField,
  SubscriptionDetail,
  SubscriptionListResponse,
  SubscriptionStatus,
  TransactionListResponse,
  UpdateSubscriptionBody,
  UpsertCancellationBody,
  User,
} from '@subtracker/contracts';
import { apiRequest } from './http';

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== '');
  return entries.length
    ? `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString()}`
    : '';
};

export const api = {
  me: () => apiRequest<User>('GET', '/me'),
  deleteAccount: (password: string) => apiRequest<void>('DELETE', '/me', { password }),

  dashboard: () => apiRequest<DashboardSummary>('GET', '/dashboard/summary'),

  providers: (q?: string) =>
    apiRequest<ProviderListResponse>('GET', `/providers${toQueryString({ q })}`).then((r) => r.items),
  provider: (slug: string) => apiRequest<Provider>('GET', `/providers/${slug}`),

  subscriptions: (status?: SubscriptionStatus) =>
    apiRequest<SubscriptionListResponse>('GET', `/subscriptions${toQueryString({ status })}`).then((r) => r.items),
  subscription: (id: string) => apiRequest<SubscriptionDetail>('GET', `/subscriptions/${id}`),
  createSubscription: (body: CreateSubscriptionBody) => apiRequest<SubscriptionDetail>('POST', '/subscriptions', body),
  updateSubscription: (id: string, body: UpdateSubscriptionBody) =>
    apiRequest<SubscriptionDetail>('PATCH', `/subscriptions/${id}`, body),
  resetField: (id: string, field: ResettableField) =>
    apiRequest<SubscriptionDetail>('POST', `/subscriptions/${id}/fields/${field}/reset`),
  deleteSubscription: (id: string) => apiRequest<void>('DELETE', `/subscriptions/${id}`),

  payments: (id: string) =>
    apiRequest<PaymentListResponse>('GET', `/subscriptions/${id}/payments`).then((r) => r.items),
  addPayment: (id: string, body: CreatePaymentBody) =>
    apiRequest<Payment>('POST', `/subscriptions/${id}/payments`, body),
  linkTransaction: (id: string, transactionId: string) =>
    apiRequest<Payment>('POST', `/subscriptions/${id}/payments/link`, { transactionId }),
  deletePayment: (id: string, paymentId: string) =>
    apiRequest<void>('DELETE', `/subscriptions/${id}/payments/${paymentId}`),

  upsertCancellation: (id: string, body: UpsertCancellationBody) =>
    apiRequest<SubscriptionDetail>('PUT', `/subscriptions/${id}/cancellation`, body),
  clearCancellation: (id: string) => apiRequest<SubscriptionDetail>('DELETE', `/subscriptions/${id}/cancellation`),

  candidates: (status: CandidateStatus = 'pending') =>
    apiRequest<CandidateListResponse>('GET', `/detection/candidates${toQueryString({ status })}`).then((r) => r.items),
  acceptCandidate: (id: string, body: AcceptCandidateBody) =>
    apiRequest<SubscriptionDetail>('POST', `/detection/candidates/${id}/accept`, body),
  rejectCandidate: (id: string) => apiRequest<void>('POST', `/detection/candidates/${id}/reject`),
  runDetection: () => apiRequest<DetectionRunResponse>('POST', '/detection/run'),

  bankLink: () => apiRequest<BankLinkResponse>('GET', '/bank/link').then((r) => r.link),
  createConnectSession: (body: CreateConnectSessionBody) =>
    apiRequest<ConnectSessionResponse>('POST', '/bank/connect-sessions', body),
  completeConnectSession: (body: CompleteConnectSessionBody) =>
    apiRequest<BankLink>('POST', '/bank/connect-sessions/complete', body),
  syncBank: () => apiRequest<BankLink>('POST', '/bank/sync'),
  bankAccounts: () => apiRequest<BankAccountListResponse>('GET', '/bank/accounts').then((r) => r.items),
  updateBankAccount: (id: string, analyzed: boolean) =>
    apiRequest<BankAccount>('PATCH', `/bank/accounts/${id}`, { analyzed }),
  unlinkBank: () => apiRequest<void>('DELETE', '/bank/link'),

  transactions: (params: { q?: string; cursor?: string; limit?: number }) =>
    apiRequest<TransactionListResponse>('GET', `/transactions${toQueryString(params)}`),

  loadDemoData: () => apiRequest<DemoDataResponse>('POST', '/dev/fixtures'),
  removeDemoData: () => apiRequest<void>('DELETE', '/dev/fixtures'),
};
