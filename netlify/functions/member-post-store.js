const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'squarespace-member-posts';
const POSTS_KEY = 'posts';

function store() {
  return getStore(STORE_NAME);
}

async function readPosts() {
  const posts = await store().get(POSTS_KEY, {
    consistency: 'strong',
    type: 'json'
  });
  return Array.isArray(posts) ? posts : [];
}

async function writePosts(posts) {
  await store().setJSON(POSTS_KEY, posts, {
    metadata: {
      updatedAt: new Date().toISOString()
    }
  });
}

module.exports = {
  readPosts,
  writePosts
};
