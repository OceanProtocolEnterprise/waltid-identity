<script setup lang="ts">
import { onMounted } from "vue";
import { useNuxtApp } from "nuxt/app";
import { useRouter } from "vue-router";
import { useAuth } from "../../../.nuxt/imports";
import {useUserStore} from "@waltid-web-wallet/stores/user.ts";
import {storeToRefs} from "pinia";
import {decodeJwt} from 'jose';

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

console.log("CALLBACK START");
onMounted(async () => {
  console.log("MOUNTED");
  
  try {
  const userData = await $auth.signinRedirectCallback();
  console.log("USER DATA:", userData);
  // TO BE FIXED ONCE signerService is set correctly
  // const signerUrl =
  //   decodeJwt(userData.access_token).signerService as string;
  //   console.log("signerUrl:", signerUrl);
  const signerUrl = "https://signerserver.demo.oceanenterprise.io:8443"

  const response = await fetch("/wallet-api/auth/account/web3/nonce", { method: "GET" });
    const challenge = await response.text();
    console.log("====Frontend DEBUG LOGS====");
    console.log("Received JWT:", challenge);

  const signerResponse = await fetch(
    `${signerUrl}/sign-message`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: challenge,
      }),
    })

    console.log("Signature Response with Signer Server:", JSON.stringify(signerResponse));
    if (!signerResponse) {
        console.error(`Signer request could not be fetched!`)
        router.push("/");
        return;
    }
    const json = await signerResponse.json();
    const address = json.address;
    const signature = json.signature;


    const verificationResponse = await fetch("/wallet-api/auth/account/web3/signed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            publicKey: address,
            signed: signature,
            challenge: challenge // Send the full tokenText (JWT)
        })
    });


    console.log("Signing message:", {
        challenge,
        address,
        messageToSign: challenge
    });

    const result = await verificationResponse.json();
    console.log("Verification result: ", result);
     await signIn(
        { token: result.token /*email: emailInput, password: passwordInput, type: "email"*/ },
        { callbackUrl: signInRedirectUrl.value }
    )
        .then(() => {
            user.value = {
                id: "",
                friendlyName: address
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