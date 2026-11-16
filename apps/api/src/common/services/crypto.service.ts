import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

@Injectable()
export class CryptoService {
  private readonly saltRounds = 10;
  private readonly encryptionKey: Buffer;

  constructor() {
    const rawKey =
      process.env.ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'super_secret_dev_jwt_key_32_characters_minimum_length_required!';
    // Derive a fixed 32-byte key for AES-256
    this.encryptionKey = crypto.createHash('sha256').update(rawKey).digest();
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateRandomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Encrypts plaintext using AES-256-GCM with authenticated data (AAD).
   */
  encryptAesGcm(plainText: string, aad?: string): EncryptedPayload {
    const iv = crypto.randomBytes(12); // Standard 12-byte IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    if (aad) {
      cipher.setAAD(Buffer.from(aad, 'utf8'));
    }

    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(plainText, 'utf8')),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  /**
   * Decrypts ciphertext using AES-256-GCM and verifies authenticity tag.
   */
  decryptAesGcm(ciphertextHex: string, ivHex: string, tagHex: string, aad?: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);

    if (aad) {
      decipher.setAAD(Buffer.from(aad, 'utf8'));
    }

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
