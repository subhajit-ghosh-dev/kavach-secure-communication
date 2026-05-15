export class ECCUtils {
    /**
     * Generate RSA-OAEP 2048 identity keypair for zero-trust endpoint.
     */
    static async generateIdentityKeyPair(): Promise<CryptoKeyPair> {
        return window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256"
            },
            true,
            ["encrypt", "decrypt"]
        );
    }

    /**
     * Export Public Key to PEM string for transmission/database storage.
     */
    static async exportPublicKey(key: CryptoKey): Promise<string> {
        const exported = await window.crypto.subtle.exportKey("spki", key);
        const exportedAsString = String.fromCharCode.apply(null, Array.from(new Uint8Array(exported)));
        const exportedAsBase64 = btoa(exportedAsString);
        return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
    }

    /**
     * Convert PEM string back to CryptoKey for encasing AES keys.
     */
    static async importPublicKey(pem: string): Promise<CryptoKey> {
        const pemHeader = "-----BEGIN PUBLIC KEY-----";
        const pemFooter = "-----END PUBLIC KEY-----";
        const pemContents = pem.substring(pemHeader.length, pem.length - pemFooter.length - 1).replace(/\n/g, "");
        const binaryDerString = window.atob(pemContents);
        const binaryDer = new Uint8Array(binaryDerString.length);

        for (let i = 0; i < binaryDerString.length; i++) {
            binaryDer[i] = binaryDerString.charCodeAt(i);
        }

        return window.crypto.subtle.importKey(
            "spki",
            binaryDer.buffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"]
        );
    }

    /**
     * Export Private Key to JWK for LocalStorage (Simulation of Android Keystore).
     */
    static async exportPrivateKeyJWK(key: CryptoKey): Promise<JsonWebKey> {
        return window.crypto.subtle.exportKey("jwk", key);
    }

    /**
     * Import Private Key from JWK.
     */
    static async importPrivateKeyJWK(jwk: JsonWebKey): Promise<CryptoKey> {
        return window.crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["decrypt"]
        );
    }

    /**
     * Wrap/Encrypt AES Session Key with Target's RSA Public Key.
     */
    static async wrapAESKey(aesRawKeyBuffer: ArrayBuffer, destinationPublicKey: CryptoKey): Promise<ArrayBuffer> {
        return window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            destinationPublicKey,
            aesRawKeyBuffer
        );
    }

    /**
     * Unwrap/Decrypt AES Session Key with Own RSA Private Key.
     */
    static async unwrapAESKey(encryptedAesKeyBuffer: ArrayBuffer, myPrivateKey: CryptoKey): Promise<ArrayBuffer> {
        return window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            myPrivateKey,
            encryptedAesKeyBuffer
        );
    }
}
