// eslint-disable-next-line @typescript-eslint/no-require-imports
import OAuth from "oauth-1.0a";
import crypto from "crypto";

const TWITTER_API_URL = "https://api.twitter.com/2/tweets";

function getOAuthClient() {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;

  if (!apiKey || !apiSecret) return null;

  return new OAuth({
    consumer: { key: apiKey, secret: apiSecret },
    signature_method: "HMAC-SHA1",
    hash_function(baseString: string, key: string) {
      return crypto.createHmac("sha1", key).update(baseString).digest("base64");
    },
  });
}

export async function postTweet(
  text: string
): Promise<{ id: string } | null> {
  const oauth = getOAuthClient();
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!oauth || !accessToken || !accessSecret) {
    console.log("[Twitter] Missing credentials, skipping");
    return null;
  }

  const requestData = {
    url: TWITTER_API_URL,
    method: "POST" as const,
  };

  const token = { key: accessToken, secret: accessSecret };
  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  const response = await fetch(TWITTER_API_URL, {
    method: "POST",
    headers: {
      ...authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twitter API ${response.status}: ${body}`);
  }

  const data = await response.json();
  return { id: data.data?.id };
}
