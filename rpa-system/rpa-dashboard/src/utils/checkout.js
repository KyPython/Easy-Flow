import { buildApiUrl } from '../utils/config';
import { api } from './api';

export async function startCheckout(planId, userId) {
  const { data } = await api.post('/api/create-checkout-session', { planId, userId });
  if (!data) throw new Error('checkout failed');
  const externalPaymentId = data.external_payment_id || null;
  // redirect to hosted checkout
  window.location.href = data.url;
  return { externalPaymentId, url: data.url };
}
