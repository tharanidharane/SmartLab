// =============================================================
// KMS Field Encryption — for PII fields (email, phone)
// =============================================================
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: process.env.AWS_REGION });
const KEY_ID = process.env.KMS_KEY_ID!;

export const encryptField = async (plaintext: string): Promise<string> => {
    const { CiphertextBlob } = await kms.send(new EncryptCommand({
        KeyId: KEY_ID,
        Plaintext: Buffer.from(plaintext),
    }));
    return Buffer.from(CiphertextBlob!).toString('base64');
};

export const decryptField = async (ciphertext: string): Promise<string> => {
    const { Plaintext } = await kms.send(new DecryptCommand({
        CiphertextBlob: Buffer.from(ciphertext, 'base64'),
    }));
    return Buffer.from(Plaintext!).toString('utf-8');
};
