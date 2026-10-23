export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startOrderExpiry } = await import('./lib/order-expiry');
    startOrderExpiry();
  }
}
