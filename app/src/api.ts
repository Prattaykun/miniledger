import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { Loan, Session, Summary } from './types';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: string;
  token?: string;
  json?: unknown;
  form?: FormData;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let body: BodyInit | undefined;
  if (options.form) {
    // Let fetch set the multipart boundary. Forcing Content-Type breaks the upload.
    body = options.form;
  } else if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as { error?: string }) : {};
  if (!response.ok) {
    throw new ApiError(data.error || `Request failed (${response.status})`, response.status);
  }
  return data as T;
}

export async function requestOtp(phone: string): Promise<{ expiresInSeconds: number }> {
  return request('/api/auth/otp', { method: 'POST', json: { phone } });
}

export async function verifyOtp(phone: string, code: string): Promise<Session & { user: { id: string; phone: string } }> {
  const body = await request<{ token: string; user: { id: string; phone: string } }>('/api/auth/verify', {
    method: 'POST',
    json: { phone, code },
  });
  return { token: body.token, phone: body.user.phone, user: body.user };
}

export async function loadLedger(token: string): Promise<{ loans: Loan[]; summary: Summary }> {
  const [loansBody, summary] = await Promise.all([
    request<{ loans: Loan[] }>('/api/loans', { token }),
    request<Summary>('/api/summary', { token }),
  ]);
  return { loans: loansBody.loans, summary };
}

export async function createLoan(
  token: string,
  input: { friendName: string; amount: string; dueDate: string; receipt: ImagePickerAsset | null },
): Promise<Loan> {
  if (!input.receipt) {
    const body = await request<{ loan: Loan }>('/api/loans', {
      method: 'POST',
      token,
      json: {
        friendName: input.friendName,
        amount: input.amount,
        dueDate: input.dueDate,
      },
    });
    return body.loan;
  }

  const form = new FormData();
  form.append('friendName', input.friendName);
  form.append('amount', input.amount);
  form.append('dueDate', input.dueDate);
  appendReceipt(form, input.receipt);
  const body = await request<{ loan: Loan }>('/api/loans', { method: 'POST', token, form });
  return body.loan;
}

export async function repayLoan(token: string, loanId: string): Promise<Loan> {
  const body = await request<{ loan: Loan }>(`/api/loans/${loanId}/repay`, {
    method: 'POST',
    token,
  });
  return body.loan;
}

export function receiptUrl(loanId: string): string {
  return `${API_URL}/api/loans/${loanId}/receipt`;
}

/**
 * Web <img> cannot send an Authorization header, so the browser build downloads
 * the photo with fetch and uses a blob URL. Native Image can send the header itself.
 */
export async function fetchReceiptObjectUrl(loanId: string, token: string): Promise<string> {
  const response = await fetch(receiptUrl(loanId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new ApiError('Could not load receipt', response.status);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

function appendReceipt(form: FormData, asset: ImagePickerAsset) {
  const name = asset.fileName ?? 'receipt.jpg';
  if (Platform.OS === 'web' && asset.file) {
    form.append('receipt', asset.file, name);
    return;
  }
  form.append(
    'receipt',
    {
      uri: asset.uri,
      name,
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob,
  );
}
