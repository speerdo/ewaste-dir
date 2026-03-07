import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  let password: string;
  try {
    const body = await request.json();
    password = body.password ?? '';
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const expected = import.meta.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isSecure = new URL(request.url).protocol === 'https:';
  const cookieParts = [
    'admin_session=authenticated',
    'HttpOnly',
    'Path=/',
    'Max-Age=28800', // 8 hours
    'SameSite=Strict',
    ...(isSecure ? ['Secure'] : []),
  ];

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieParts.join('; '),
    },
  });
};
