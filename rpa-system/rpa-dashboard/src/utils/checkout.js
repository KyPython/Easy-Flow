import { buildApiUrl } from '../utils/config';

export async function startCheckout(planId, userId) {
  const resp = await fetch(buildApiUrl('/api/create-checkout-session'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ planId, userId }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'checkout failed');
  // Return the external_payment_id so callers can track or display it, then redirect
  const externalPaymentId = data.external_payment_id || null;
  // redirect to hosted checkout
  window.location.href = data.url;
  return { externalPaymentId, url: data.url };
}
