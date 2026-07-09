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
    const query = queryString ? new URLSearchParams(queryString) : null;
    const [pathAddress, functionName] = addressPart.split('/');

    // EIP-681 token-transfer calls (e.g. "ethereum:<token>/transfer?address=<recipient>&uint256=<amount>")
    // put the ERC-20 CONTRACT address in the path and the real recipient in the "address" query
    // param — using the path address as the recipient sends tokens to the contract itself.
    if (functionName && query?.has('address')) {
      return { address: query.get('address')!, amount: query.get('amount') };
    }

    return { address: pathAddress, amount: query ? query.get('amount') : null };
  }

  // 3. Plain address fallback
  return { address: data, amount: null };
}
