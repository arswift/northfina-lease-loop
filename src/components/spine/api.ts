import type { z } from 'zod';
import { readApiResponse } from './response-reader';
export { RequestFailure } from './response-reader';

export type DemoSelection = { customerId: string; businessDate: string };

/** The caller supplies the endpoint schema; the return type is its validated output. */
export async function requestJson<S extends z.ZodType>(
  path: string,
  selection: DemoSelection,
  schema: S,
  body?: unknown,
  operator = false,
  signal?: AbortSignal
): Promise<z.output<S>> {
  const headers: Record<string, string> = { 'x-demo-role': operator ? 'operator' : 'customer' };
  if (selection.customerId) headers['x-demo-customer'] = selection.customerId;
  if (selection.businessDate) headers['x-demo-date'] = selection.businessDate;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch('/api/spine/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  return readApiResponse(response, schema);
}
