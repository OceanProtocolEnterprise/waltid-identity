package id.walt.ktorauthnz.methods

import id.walt.ktorauthnz.KtorAuthnzManager
import id.walt.ktorauthnz.exceptions.authCheck
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.*
import io.ktor.client.statement.bodyAsText
import io.ktor.http.*
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.*
import org.web3j.abi.FunctionEncoder
import org.web3j.abi.datatypes.DynamicBytes
import org.web3j.abi.datatypes.Function
import org.web3j.abi.datatypes.generated.Bytes32
import org.web3j.crypto.Sign
import org.web3j.utils.Numeric

/** Validates deployed accounts on the server's configured chain, without submitting a transaction. */
internal class SmartAccountSignatureVerifier(
    private val client: HttpClient = HttpClient {
        install(HttpTimeout) {
            requestTimeoutMillis = System.getenv("SMART_ACCOUNT_RPC_REQUEST_TIMEOUT_MS")
                ?.toLongOrNull()?.takeIf { it > 0 } ?: 15_000L
            connectTimeoutMillis = System.getenv("SMART_ACCOUNT_RPC_CONNECT_TIMEOUT_MS")
                ?.toLongOrNull()?.takeIf { it > 0 } ?: 5_000L
            socketTimeoutMillis = System.getenv("SMART_ACCOUNT_RPC_SOCKET_TIMEOUT_MS")
                ?.toLongOrNull()?.takeIf { it > 0 } ?: 15_000L
        }
    },
) {
    suspend fun verify(
        challenge: String,
        signature: String,
        address: String,
        rpcUrl: String? = KtorAuthnzManager.smartAccountBundlerRPC,
    ): String {
        authCheck(!rpcUrl.isNullOrBlank()) { "AA signature verification is not configured" }
        authCheck(Regex("0x[0-9a-fA-F]{40}").matches(address)) { "Invalid smart-account address" }
        authCheck(
            signature.length <= 131_074 && Regex("0x(?:[0-9a-fA-F]{2})*").matches(signature),
        ) { "Invalid smart-account signature encoding" }
        val function = Function(
            "isValidSignature",
            listOf(Bytes32(Sign.getEthereumMessageHash(challenge.toByteArray(Charsets.UTF_8))), DynamicBytes(Numeric.hexStringToByteArray(signature))),
            emptyList(),
        )
        val body = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", 1)
            put("method", "eth_call")
            putJsonArray("params") {
                addJsonObject {
                    put("to", address)
                    put("data", FunctionEncoder.encode(function))
                }
                add("latest")
            }
        }
        val valid = try {
            val response = client.post(rpcUrl) {
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }
            val payload = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            // An EOA or undeployed account returns empty data; reverts and RPC errors also fail closed.
            response.status.isSuccess() && payload["error"] == null &&
                payload["result"]?.jsonPrimitive?.content?.lowercase() == "0x1626ba7e" + "00".repeat(28)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // RPC exceptions may contain credentials or the signed challenge.
            false
        }
        authCheck(valid) { "Smart-account signature verification failed" }
        return address.lowercase()
    }
}
