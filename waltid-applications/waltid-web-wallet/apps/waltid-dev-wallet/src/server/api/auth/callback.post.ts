import type { H3Event } from "h3";
import { decodeJwt } from "jose";

function getRequestOrigin(event: H3Event): string {
  const host = getRequestHeader(event, "host");
  const forwardedProto = getRequestHeader(event, "x-forwarded-proto");
  const protocol = forwardedProto?.split(",")[0]?.trim() || "https";

  if (!host) {
    throw createError({ statusCode: 400, message: "Host header missing" });
  }

  return `${protocol}://${host}`;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody(event);

  let tokenResponse: any;
  try {
    const params: Record<string, string> = {
      grant_type: "authorization_code",
      code: body.code,
      client_id: config.public.clientId as string,
      client_secret: config.clientSecret as string,
      redirect_uri: config.public.redirectUri as string,
    };

    if (body.code_verifier) {
      params.code_verifier = body.code_verifier;
    }

    tokenResponse = await $fetch(config.tokenUrl as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });
  } catch (err: any) {
    console.error("[callback] token exchange:", err?.data || err?.message);
    throw createError({
      statusCode: err?.statusCode || 502,
      message: "Token exchange failed: " + JSON.stringify(err?.data || err?.message),
    });
  }

  const accessToken = tokenResponse.access_token;
  const decoded = decodeJwt(accessToken);
  const signerUrl = decoded.signerServer as string;

  if (!signerUrl) {
    throw createError({ statusCode: 400, message: "signerServer claim missing from token" });
  }

  let challenge: any;
  try {
    challenge = await $fetch(`${config.walletApiInternal}/auth/account/web3/nonce`);
  } catch (err: any) {
    console.error("[callback] nonce:", err?.data || err?.message);
    throw createError({
      statusCode: 502,
      message: "Nonce failed: " + JSON.stringify(err?.data || err?.message),
    });
  }

  let signerResponse: any;
  try {
    const origin = getRequestOrigin(event);
    console.log("[callback] calling signer at", signerUrl, "with origin", origin);

    signerResponse = await $fetch(`${signerUrl}/api/v1/sign-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: { message: challenge },
    });
  } catch (err: any) {
    console.error("[callback] signer:", err?.data || err?.message);
    throw createError({
      statusCode: err?.statusCode || 502,
      message: "Signer failed: " + JSON.stringify(err?.data || err?.message),
    });
  }

  let verification: any;
  try {
    verification = await $fetch(`${config.walletApiInternal}/auth/account/web3/signed`, {
      method: "POST",
      body: {
        publicKey: signerResponse.address,
        signed: signerResponse.signature,
        challenge,
      },
    });
  } catch (err: any) {
    console.error("[callback] verification:", err?.data || err?.message);
    throw createError({
      statusCode: 502,
      message: "Verification failed: " + JSON.stringify(err?.data || err?.message),
    });
  }

  return {
    token: verification.token,
    address: signerResponse.address,
  };
});