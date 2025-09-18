const fetch = require('node-fetch');

async function shopifyGraphQL(shopDomain, token, query) {
  const url = `https://${shopDomain}/admin/api/2024-10/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token
    },
    body: JSON.stringify({ query })
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json;
}

function gidToId(gid) {
  // e.g. "gid://shopify/Product/1234567890" -> "1234567890"
  if (!gid) return '';
  const parts = gid.split('/');
  return parts[parts.length - 1];
}

module.exports = { shopifyGraphQL, gidToId };
