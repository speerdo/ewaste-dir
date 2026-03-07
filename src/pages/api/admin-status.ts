import type { APIRoute } from 'astro';

function getAdminSessionCookie(cookieHeader: string): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key.trim() === 'admin_session') return rest.join('=').trim();
  }
  return undefined;
}

export const GET: APIRoute = async ({ request }) => {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const session = getAdminSessionCookie(cookieHeader);

  if (session === 'authenticated') {
    return new Response(JSON.stringify({ authenticated: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ authenticated: false }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
};
