import crypto from 'crypto';
import { getDb } from '../db';
import { agentCredentials } from '../db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================
// GiLo AI – Secure Credential Storage Service
// Uses AES-256-GCM encryption for all sensitive data.
// ============================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;   // 128 bits
const TAG_LENGTH = 16;  // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Derive a 256-bit key from the master secret using PBKDF2.
 * The master secret comes from CREDENTIAL_ENCRYPTION_KEY env var.
 */
function getEncryptionKey(): Buffer {
  const masterKey = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET || 'gilo-default-encryption-key-change-me';
  // Use PBKDF2 to derive a proper 32-byte key
  return crypto.pbkdf2Sync(masterKey, 'gilo-ai-credential-salt', 100000, 32, 'sha512');
}

/**
 * Encrypt a plaintext value using AES-256-GCM.
 * Output format: base64(salt + iv + tag + ciphertext)
 */
function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Concatenate: salt + iv + tag + ciphertext
  const result = Buffer.concat([salt, iv, tag, encrypted]);
  return result.toString('base64');
}

/**
 * Decrypt a base64 encoded AES-256-GCM ciphertext.
 */
function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encoded, 'base64');

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Mask a credential value for display.
 * Shows first 4 and last 2 chars, rest masked with ●
 */
function maskValue(value: string): string {
  if (value.length <= 8) return '●'.repeat(value.length);
  return value.slice(0, 4) + '●'.repeat(Math.min(value.length - 6, 12)) + value.slice(-2);
}

// ============================================================
// Credential Service
// ============================================================

export class CredentialService {
  /**
   * Save (or update) an encrypted credential for an agent.
   */
  async saveCredential(
    agentId: string,
    userId: string,
    service: string,
    key: string,
    value: string,
  ): Promise<{ id: string; service: string; key: string; maskedValue: string }> {
    const encryptedValue = encrypt(value);

    // Check if credential already exists
    const existing = await getDb()
      .select()
      .from(agentCredentials)
      .where(
        and(
          eq(agentCredentials.agentId, agentId),
          eq(agentCredentials.service, service),
          eq(agentCredentials.key, key),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Update
      await getDb()
        .update(agentCredentials)
        .set({
          encryptedValue,
          updatedAt: new Date(),
        })
        .where(eq(agentCredentials.id, existing[0].id));

      return {
        id: existing[0].id,
        service,
        key,
        maskedValue: maskValue(value),
      };
    }

    // Insert new
    const [inserted] = await getDb()
      .insert(agentCredentials)
      .values({
        agentId,
        userId,
        service,
        key,
        encryptedValue,
      })
      .returning();

    return {
      id: inserted.id,
      service,
      key,
      maskedValue: maskValue(value),
    };
  }

  /**
   * Get all credentials for an agent (masked values only).
   */
  async listCredentials(agentId: string): Promise<Array<{
    id: string;
    service: string;
    key: string;
    maskedValue: string;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    const creds = await getDb()
      .select()
      .from(agentCredentials)
      .where(eq(agentCredentials.agentId, agentId));

    return creds.map((c) => {
      let maskedVal = '●●●●●●●●';
      try {
        const decrypted = decrypt(c.encryptedValue);
        maskedVal = maskValue(decrypted);
      } catch {
        // If decryption fails, show generic mask
      }
      return {
        id: c.id,
        service: c.service,
        key: c.key,
        maskedValue: maskedVal,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });
  }

  /**
   * Get the decrypted value of a specific credential (for internal use only).
   * NEVER expose this directly to the frontend.
   */
  async getDecryptedValue(credentialId: string, agentId: string): Promise<string | null> {
    const [cred] = await getDb()
      .select()
      .from(agentCredentials)
      .where(
        and(
          eq(agentCredentials.id, credentialId),
          eq(agentCredentials.agentId, agentId),
        ),
      )
      .limit(1);

    if (!cred) return null;

    try {
      return decrypt(cred.encryptedValue);
    } catch {
      return null;
    }
  }

  /**
   * Delete a credential.
   */
  async deleteCredential(credentialId: string, agentId: string): Promise<boolean> {
    const result = await getDb()
      .delete(agentCredentials)
      .where(
        and(
          eq(agentCredentials.id, credentialId),
          eq(agentCredentials.agentId, agentId),
        ),
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Delete all credentials for an agent.
   */
  async deleteAllForAgent(agentId: string): Promise<number> {
    const result = await getDb()
      .delete(agentCredentials)
      .where(eq(agentCredentials.agentId, agentId))
      .returning();

    return result.length;
  }
}

// Singleton
export const credentialService = new CredentialService();
