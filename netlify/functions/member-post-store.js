const { connectLambda, getStore } = require('@netlify/blobs');

const STORE_NAME = 'squarespace-member-posts';
const POSTS_KEY = 'posts';

function store(event) {
  if (event) connectLambda(event);
  return getStore(STORE_NAME);
}

async function readPosts(event) {
  const posts = await store(event).get(POSTS_KEY, {
    consistency: 'strong',
    type: 'json'
  });
  return Array.isArray(posts) ? posts : [];
}

async function writePosts(posts, event) {
  await store(event).setJSON(POSTS_KEY, posts, {
    metadata: {
      updatedAt: new Date().toISOString()
    }
  });
}

module.exports = {
  readPosts,
  writePosts
};
