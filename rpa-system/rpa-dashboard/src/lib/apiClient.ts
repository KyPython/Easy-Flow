const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

async function handleResponse(res: Response) {
 const text = await res.text();
 let body: any = null;
 try {
 body = text ? JSON.parse(text) : null;
 } catch (e) {
 // ignore json parse errors
 }

 if (!res.ok) {
 const msg = body?.message || res.statusText || 'Request failed';
 const err: any = new Error(msg);
 err.status = res.status;
 err.body = body;
 throw err;
 }

 return body;
}

function buildHeaders(token?: string, extra?: Record<string, string>) {
 const headers: Record<string, string> = {
 ...(extra || {})
 };
 if (token) headers['Authorization'] = `Bearer ${token}`;
 return headers;
}

export async function get(path: string, token?: string) {
 const res = await fetch(`${API_BASE}${path}`, {
 method: 'GET',
 headers: buildHeaders(token)
 });
 return handleResponse(res);
}

export async function post(path: string, body?: any, token?: string) {
 const res = await fetch(`${API_BASE}${path}`, {
 method: 'POST',
 headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
 body: body ? JSON.stringify(body) : undefined
 });
 return handleResponse(res);
}

export async function put(path: string, body?: any, token?: string) {
 const res = await fetch(`${API_BASE}${path}`, {
 method: 'PUT',
 headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
 body: body ? JSON.stringify(body) : undefined
 });
 return handleResponse(res);
}

export async function del(path: string, token?: string) {
 const res = await fetch(`${API_BASE}${path}`, {
 method: 'DELETE',
 headers: buildHeaders(token)
 });
 return handleResponse(res);
}

export default { get, post, put, del };
