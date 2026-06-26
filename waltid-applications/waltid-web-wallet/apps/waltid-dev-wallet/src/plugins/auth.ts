import { UserManager } from "oidc-client-ts";

let userManager: UserManager | null = null;

export default defineNuxtPlugin(() => {
  if (import.meta.server) return;
  const config = useRuntimeConfig()
  if (
    !config.public.issuer ||
    !config.public.clientId ||
    !config.public.redirectUri
  ) {
    console.log("OIDC plugin skipped: missing required config values");
    return {
      provide: {
        auth: null as UserManager | null,
      },
    };
  }
  if (!userManager) {
    userManager = new UserManager({
      authority: config.public.issuer as string,
      client_id: config.public.clientId as string,
      redirect_uri: config.public.redirectUri as string,
      response_type: "code",
      scope: config.public.scope as string,
      post_logout_redirect_uri: config.public.postLogoutRedirectUri as string
    });
  }
  console.log("OIDC is initialized!");

  return {
    provide: {
      auth: userManager as UserManager | null,
    },
  };
});