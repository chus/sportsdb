const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_API_BASE = "https://oauth.reddit.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) return null;

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(REDDIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "DataSports/1.0",
    },
    body: new URLSearchParams({
      grant_type: "password",
      username,
      password,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Reddit auth ${response.status}: ${body}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

export async function postToReddit(params: {
  subreddit: string;
  title: string;
  url: string;
}): Promise<{ id: string } | null> {
  const token = await getAccessToken();
  if (!token) {
    console.log("[Reddit] Missing credentials, skipping");
    return null;
  }

  const response = await fetch(`${REDDIT_API_BASE}/api/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "DataSports/1.0",
    },
    body: new URLSearchParams({
      sr: params.subreddit,
      kind: "link",
      title: params.title,
      url: params.url,
      resubmit: "true",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Reddit API ${response.status}: ${body}`);
  }

  const data = await response.json();

  if (data.json?.errors?.length > 0) {
    throw new Error(`Reddit submit error: ${JSON.stringify(data.json.errors)}`);
  }

  const postId = data.json?.data?.id || data.json?.data?.name;
  return postId ? { id: postId } : null;
}
