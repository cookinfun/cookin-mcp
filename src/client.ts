// How a call reaches the Cookin API, and how it gets paid for.
//
// Three modes, picked from the environment once at startup:
//
//   * COOKIN_API_KEY set: a Pro key goes out as a Bearer token. Nothing
//     is charged per call.
//   * SOLANA_KEY set: every call is paid per request with x402 (USDC on
//     Solana). The wallet needs USDC only, because the facilitator pays
//     the network fee, and a call that errors is never charged.
//   * neither: calls go out unpaid, so every one comes back 402. The
//     error says the price and how to pay, which is more useful to an
//     agent than a silent failure.
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const DEFAULT_BASE_URL = "https://api.cookin.fun";

// Refuses to sign anything above this per call, so a misread price or a
// changed offer cannot drain a wallet. $0.05 is well above the $0.02
// snapshot, the dearest route today.
const DEFAULT_MAX_PAYMENT = "$0.05";

export type PaymentMode = "pro-key" | "x402" | "unpaid";

export type CookinClient = {
  mode: PaymentMode;
  /** Calls `path` and returns the parsed JSON body. Throws on failure. */
  get: (path: string) => Promise<unknown>;
};

export async function createClient(env = process.env): Promise<CookinClient> {
  const baseUrl = env.COOKIN_BASE_URL ?? DEFAULT_BASE_URL;
  const apiKey = env.COOKIN_API_KEY;
  const solanaKey = env.SOLANA_KEY ?? env.COOKIN_SOLANA_KEY;

  if (apiKey) {
    return {
      mode: "pro-key",
      get: (path) =>
        request(baseUrl + path, fetch, { Authorization: `Bearer ${apiKey}` }),
    };
  }

  if (solanaKey) {
    const client = new x402Client();
    client.setSpendControls({
      maxAmountPerPayment: env.COOKIN_MAX_PAYMENT ?? DEFAULT_MAX_PAYMENT,
    });
    registerExactSvmScheme(client, {
      signer: await createKeyPairSignerFromBytes(base58.decode(solanaKey)),
    });

    const paidFetch = wrapFetchWithPayment(fetch, client);
    return { mode: "x402", get: (path) => request(baseUrl + path, paidFetch) };
  }

  return { mode: "unpaid", get: (path) => request(baseUrl + path, fetch) };
}

// ----------------------------------------------------------------
// Internals
// ----------------------------------------------------------------

async function request(
  url: string,
  fetchImpl: typeof fetch,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const response = await fetchImpl(url, { headers });
  const body = await response.text();

  if (response.ok) return JSON.parse(body);

  throw new Error(failureMessage(response.status, body));
}

// The API answers every failure with the same envelope, so the message
// an agent sees is Cookin's own wording plus, on a 402, what to do next.
function failureMessage(status: number, body: string): string {
  let message = body.slice(0, 500);

  try {
    const parsed = JSON.parse(body);
    if (parsed?.error?.message) message = parsed.error.message;
  } catch {
    // Not JSON (a proxy error page, say). The raw body is the best hint.
  }

  if (status === 402) {
    return (
      `${message} Set SOLANA_KEY to a base58 Solana keypair holding USDC to pay ` +
      `per call, or COOKIN_API_KEY to a Cookin Pro key from ` +
      `https://cookin.fun/account/api-keys`
    );
  }

  return `Cookin API returned ${status}: ${message}`;
}
