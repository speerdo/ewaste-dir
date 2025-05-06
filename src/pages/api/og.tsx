import { ImageResponse } from '@vercel/og';
import type { APIRoute } from 'astro';

export const prerender = false;

// Set runtime to edge
export const config = {
  runtime: 'edge',
};

export const GET: APIRoute = async ({ url }) => {
  const params = new URL(url).searchParams;
  const city = params.get('city');
  const state = params.get('state');
  const centerCount = params.get('centers');

  if (!city && !state) {
    return new Response('Missing required parameters', { status: 400 });
  }

  try {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            padding: '40px 60px',
          }}
        >
          {/* Green recycling icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: '#16A34A',
              padding: '20px',
              marginBottom: '30px',
            }}
          >
            <svg
              width='64'
              height='64'
              viewBox='0 0 24 24'
              fill='none'
              style={{ color: 'white' }}
            >
              <path
                d='M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              fontSize: 60,
              fontWeight: 'bold',
              letterSpacing: '-0.025em',
              color: '#111827',
              marginBottom: '20px',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {city ? `${city}, ${state}` : state}
          </div>

          {/* Subtitle */}
          {centerCount && (
            <div
              style={{
                display: 'flex',
                fontSize: 30,
                color: '#4B5563',
                marginBottom: '10px',
                textAlign: 'center',
              }}
            >
              {centerCount} Electronics Recycling{' '}
              {parseInt(centerCount) === 1 ? 'Center' : 'Centers'}
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 630,
        // Add support for emoji and other special characters
        emoji: 'twemoji',
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate image: ${e.message}`, {
      status: 500,
    });
  }
};
