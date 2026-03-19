const BadWord = require('../models/BadWord');

// キャッシュ（毎回DBを叩かないように）
let cachedWords = [];
let lastFetched = 0;
const CACHE_TTL = 60 * 1000; // 1分キャッシュ

async function getBadWords() {
  if (Date.now() - lastFetched < CACHE_TTL && cachedWords.length > 0) {
    return cachedWords;
  }
  const words = await BadWord.find().select('word');
  cachedWords = words.map(w => w.word.toLowerCase());
  lastFetched = Date.now();
  return cachedWords;
}

// キャッシュ強制リフレッシュ（管理者が追加・削除した時）
function invalidateCache() {
  lastFetched = 0;
}

// テキストに禁句が含まれるか確認
async function containsBadWord(text) {
  if (!text) return false;
  const words = await getBadWords();
  const lower = text.toLowerCase();
  return words.some(w => lower.includes(w));
}

// テキストの禁句を★★★に置換
async function maskBadWords(text) {
  if (!text) return text;
  const words = await getBadWords();
  let result = text;
  words.forEach(w => {
    const regex = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, '★'.repeat(w.length));
  });
  return result;
}

module.exports = { containsBadWord, maskBadWords, invalidateCache };
