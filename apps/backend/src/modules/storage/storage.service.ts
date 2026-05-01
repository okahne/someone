import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { AppConfig } from '../../config/app.config';

export interface StoredObject {
    storageKey: string;
    sizeBytes: number;
    mimeType: string;
}

/**
 * Storage adapter abstraction. Local-filesystem implementation by default.
 * Replace via DI in deployed environments to swap to S3/etc.
 */
@Injectable()
export class StorageService {
    private readonly root: string;

    constructor(config: ConfigService) {
        const cfg = config.getOrThrow<AppConfig>('app');
        this.root = path.resolve(cfg.storageRoot);
    }

    async put(buffer: Buffer, mimeType: string, namespace: string): Promise<StoredObject> {
        const ext = mimeToExt(mimeType);
        const key = `${namespace}/${randomUUID()}${ext}`;
        const fullPath = path.join(this.root, key);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, buffer);
        return { storageKey: key, sizeBytes: buffer.length, mimeType };
    }

    async get(storageKey: string): Promise<Buffer> {
        return fs.readFile(path.join(this.root, storageKey));
    }

    async delete(storageKey: string): Promise<void> {
        try {
            await fs.unlink(path.join(this.root, storageKey));
        } catch {
            // Best effort
        }
    }
}

function mimeToExt(mime: string): string {
    switch (mime) {
        case 'image/jpeg': return '.jpg';
        case 'image/png': return '.png';
        case 'image/webp': return '.webp';
        case 'image/gif': return '.gif';
        default: return '';
    }
}
