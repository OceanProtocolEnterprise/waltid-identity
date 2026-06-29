import { decodeJwt } from "jose";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody(event);

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

  const tokenResponse = await $fetch(config.tokenUrl as string, {
      method: "POST",
      headers: {
          "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
  }) as any;

  const accessToken = tokenResponse.access_token;

  const decoded = decodeJwt(accessToken);
  const signerUrl = decoded.signerServer as string;

  if (!signerUrl) {
    throw createError({ statusCode: 400, message: "signerServer claim missing from token" });
  }

  const challenge = await $fetch(
    `${config.walletApiInternal}/auth/account/web3/nonce`
  );

  const signerResponse = await $fetch(`${signerUrl}/api/v1/sign-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: {
      message: challenge,
    },
  }) as any;

  const verification = await $fetch(
    `${config.walletApiInternal}/auth/account/web3/signed`,
    {
      method: "POST",
      body: {
        publicKey: signerResponse.address,
        signed: signerResponse.signature,
        challenge,
      },
    }
  ) as any;

  return {
    token: verification.token,
    address: signerResponse.address
  };
});