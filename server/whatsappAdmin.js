export function getServerSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

export async function getAuthenticatedUser(req) {
  const { url, anonKey } = getServerSupabaseConfig();
  const authorization = req.headers.authorization || '';
  if (!url || !anonKey || !authorization.startsWith('Bearer ')) return null;

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
    });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

export async function requireMetaAdmin(req) {
  const expectedUserId = process.env.META_ADMIN_USER_ID || '';
  if (!expectedUserId) return { ok: false, status: 503, error: 'Admin API is not configured.' };

  const user = await getAuthenticatedUser(req);
  if (!user || user.id !== expectedUserId)
    return { ok: false, status: 401, error: 'Unauthorized.' };

  return { ok: true, user };
}

export function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.send(body);
}
