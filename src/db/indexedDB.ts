import { Feature, CacheEntry } from '../types';

const DB_NAME = 'TestGenDB';
const DB_VERSION = 1;

export class TestGenDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Features object store
        if (!db.objectStoreNames.contains('features')) {
          db.createObjectStore('features', { keyPath: 'id' });
        }

        // Cache object store
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'cacheKey' });
        }
      };

      request.onsuccess = async (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        try {
          await this.seedInitialFeaturesIfEmpty();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private async seedInitialFeaturesIfEmpty(): Promise<void> {
    const features = await this.getFeatures();
    if (features.length > 0) return;

    const initialFeatures: Feature[] = [
      {
        id: 'LOGIN-001',
        name: 'User Authentication & Login',
        version: '1.0',
        description: 'Authenticates users via username/email and password credentials.',
        input_fields: [
          { name: 'username', type: 'string', required: true, format: 'email|phone' },
          { name: 'password', type: 'string', required: true, min: 8, max: 20 }
        ],
        business_rules: [
          'Lock account for 30 minutes after 5 consecutive failed attempts',
          'Require CAPTCHA verification after 3 consecutive failed attempts'
        ],
        output: {
          token: 'string',
          expires_in: 'integer'
        },
        dependencies: ['REGISTER-001', 'RESET-001']
      },
      {
        id: 'REGISTER-001',
        name: 'User Account Registration',
        version: '1.0',
        description: 'Registers new user account with dual-factor CAPTCHA and SMS verification.',
        input_fields: [
          { name: 'phone', type: 'string', required: true, format: 'phone' },
          { name: 'password', type: 'string', required: true, min: 8, max: 20 },
          { name: 'sms_code', type: 'string', required: true, min: 6, max: 6 },
          { name: 'captcha_code', type: 'string', required: true }
        ],
        business_rules: [
          'Phone number must not already be registered',
          'SMS verification code expires in 5 minutes with a 1-minute rate limit per send',
          'Password must contain upper/lower case letters and digits'
        ],
        output: {
          user_id: 'string',
          status: 'success'
        },
        dependencies: []
      },
      {
        id: 'ORDER-001',
        name: 'Order Creation & Checkout',
        version: '1.1',
        description: 'Submits items from shopping cart, reserves inventory, and creates a pending payment order.',
        input_fields: [
          { name: 'items', type: 'array', required: true },
          { name: 'address_id', type: 'string', required: true },
          { name: 'coupon_id', type: 'string', required: false }
        ],
        business_rules: [
          'Maximum allowed items per single order is 99 units',
          'Invalid or expired coupon should return an error prompt without blocking order creation',
          'Deduct and lock stock inventory immediately upon order placement'
        ],
        output: {
          order_id: 'string',
          total_price: 'number',
          status: 'pending_payment'
        },
        dependencies: ['LOGIN-001']
      }
    ];

    for (const f of initialFeatures) {
      await this.saveFeature(f);
    }
  }

  private getStore(storeName: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Features APIs
  getFeatures(): Promise<Feature[]> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('features', 'readonly');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  getFeature(id: string): Promise<Feature | undefined> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('features', 'readonly');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  saveFeature(feature: Feature): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('features', 'readwrite');
        const request = store.put(feature);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  deleteFeature(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('features', 'readwrite');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Cache APIs
  getCache(key: string): Promise<CacheEntry | undefined> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('cache', 'readonly');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  saveCache(key: string, data: CacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('cache', 'readwrite');
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  clearCache(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('cache', 'readwrite');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  getCacheCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('cache', 'readonly');
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }
}
