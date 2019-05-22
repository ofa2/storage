import StorageApi, { IStorageConfig } from './StorageApi';

async function lift(this: { config: { storage: IStorageConfig }; storage: StorageApi }) {
  if (!this.config.storage) {
    throw new Error('no storage config found');
  }

  if (!this.config.storage.baseUrl) {
    throw new Error('qiniu config need baseUrl, accessKey, secretKey, scope');
  }

  let storage = new StorageApi(this.config.storage);
  this.storage = storage;
  return storage;
}

export { lift, StorageApi, IStorageConfig };
export default lift;
