import ChatMessage from '../models/ChatMessage.js';
import DiaryEntry from '../models/DiaryEntry.js';

function isKey(index, expected) {
  const keys = Object.keys(index.key || {});
  return keys.length === Object.keys(expected).length &&
    keys.every(key => index.key[key] === expected[key]);
}

export async function maintainDatabaseIndexes() {
  await Promise.all([ChatMessage.createIndexes(), DiaryEntry.createIndexes()]);

  const chatCollection = ChatMessage.collection;
  const chatIndexes = await chatCollection.indexes();
  for (const index of chatIndexes) {
    const oldDirection = isKey(index, { sender: 1, recipient: 1, createdAt: 1 }) ||
      isKey(index, { recipient: 1, sender: 1, createdAt: 1 });
    if (oldDirection) await chatCollection.dropIndex(index.name);
  }

  const diaryCollection = DiaryEntry.collection;
  const diaryIndexes = await diaryCollection.indexes();
  const hasCompoundIndex = diaryIndexes.some(index => isKey(index, {
    user: 1,
    watchedAt: -1,
    createdAt: -1,
  }));
  const redundantUserIndex = diaryIndexes.find(index => isKey(index, { user: 1 }));
  if (hasCompoundIndex && redundantUserIndex) {
    await diaryCollection.dropIndex(redundantUserIndex.name);
  }
}
