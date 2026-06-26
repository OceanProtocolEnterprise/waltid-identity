<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import {useUserStore} from "@waltid-web-wallet/stores/user.ts";
import {storeToRefs} from "pinia";

definePageMeta({
    title: "Callback login to your wallet - walt.id",
    auth: false,
    layout: "minimal"
});

const router = useRouter();
const { status, data, signIn } = useAuth();
const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const signInRedirectUrl = ref("/");
const { $auth } = useNuxtApp();

const isExchanging = ref(false);
onMounted(async () => {
  if (isExchanging.value) return;
  isExchanging.value = true;
  
  try {
  const route = useRoute();
  const code = route.query.code as string;
  const state = route.query.state as string;
  if (!code || !state) {
      await router.push("/login");
      return;
    }

    const oidcState = await $auth.settings.stateStore!.get(state);
    const parsedState = oidcState ? JSON.parse(oidcState as string) : null;
    const codeVerifier = parsedState?.code_verifier ?? null;

    if (!codeVerifier) {
      console.error("No code_verifier found in OIDC state store");
      await router.push("/login");
      return;
    }

    const result = await $fetch("/api/auth/callback", {
      method: "POST",
      body: { code, state, code_verifier: codeVerifier }
    }) as any;
  
    console.log("Verification result: ", result);
     await signIn(
        { token: result.token /*email: emailInput, password: passwordInput, type: "email"*/ },
        { callbackUrl: signInRedirectUrl.value }
    )
        .then(() => {
            user.value = {
                id: "",
                friendlyName: result.address
            };
        })
        .catch((err) => {
            console.error("Could not sign in", err);
            router.push("/");
            return;
        });
      } catch(error) {
        console.error("Callback error:", error.message);
        await router.push("/login");
      }
    
});
</script>

<template>
  Signing in with Signer Server...
</template>