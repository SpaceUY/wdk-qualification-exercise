import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';

let mongod: MongoMemoryServer | undefined;

export async function startInMemoryMongo(): Promise<string> {
  mongod = await MongoMemoryServer.create();
  return mongod.getUri();
}

export async function stopInMemoryMongo(): Promise<void> {
  if (mongod) {
    await mongod.stop();
    mongod = undefined;
  }
}

export async function clearCollections(connection: Connection): Promise<void> {
  await Promise.all(
    Object.values(connection.collections).map((collection) => collection.deleteMany({})),
  );
}
