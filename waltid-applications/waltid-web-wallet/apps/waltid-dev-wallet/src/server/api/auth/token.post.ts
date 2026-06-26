export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  return await $fetch(config.tokenUrl as string, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: body.code,
    client_id: config.public.clientId as string,
    client_secret: config.clientSecret as string,
    scope: body.scope,
    redirect_uri: body.redirect_uri as string,
    code_verifier: body.code_verifier as string,
  }).toString(),
})
})