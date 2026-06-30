export type MerchantQRPayload = {
  address: string;
  amount: string | null;
};

const URI_SCHEMES = ['ethereum:', 'bitcoin:', 'tron:'];

export function parseMerchantQR(data: string): MerchantQRPayload {
  // 1. JSON merchant format: {"to":"<address>","amount":"<value>"}
  try {
    const json = JSON.parse(data) as Record<string, unknown>;
    if (typeof json.to === 'string') {
      return {
        address: json.to,
        amount: typeof json.amount === 'string' ? json.amount : null,
      };
    }
  } catch {
    // not JSON — fall through
  }

  // 2. URI format: scheme:<address>[/path][?query]
  const matchedScheme = URI_SCHEMES.find((s) => data.startsWith(s));
  if (matchedScheme) {
    const withoutScheme = data.slice(matchedScheme.length);
    const [addressPart, queryString] = withoutScheme.split('?');
    const address = addressPart.split('/')[0];
    const amount = queryString ? new URLSearchParams(queryString).get('amount') : null;
    return { address, amount };
  }

  // 3. Plain address fallback
  return { address: data, amount: null };
}
