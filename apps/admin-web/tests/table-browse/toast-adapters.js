export const useRouter = () => ({ refresh() {}, replace() {}, push() {} });
export const createSupabaseBrowserClient = () => ({ auth: {
  onAuthStateChange(callback) { callback('INITIAL_SESSION', { user: { id: 'admin-one' } }); return { data: { subscription: { unsubscribe() {} } } }; },
} });
export const formatCentavosAsPHP = amount => `PHP ${(amount / 100).toFixed(2)}`;
export const serviceFoundationOperations = () => ({ async transitionSla() {
  window.toastFixture.writes++;
  await new Promise(resolve => setTimeout(resolve, 80));
  if (window.toastFixture.result === 'throw') throw new Error('Fixture transport failure');
  return { error: window.toastFixture.result === 'error' ? { message: 'Fixture rejected change.' } : null };
} });
export const markPaymentCollected = async () => ({ error: null });
