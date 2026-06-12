import { ImageResponse } from '@vercel/og';
import React from 'react';

// ---------------------------------------------------------------------------
// /api/og — dynamic Open Graph share image for a single match.
//
// Pure renderer: all content comes from query params so this edge function
// stays small and has no data dependencies. /api/share builds the URL.
//   ?h=England&a=USA&meta=Group%20F%20%C2%B7%20Sat%2013%20Jun&venue=...
//
// 1200x630 is the standard OG/Twitter card size. JSX is avoided so the file
// compiles as a plain .ts edge function; elements are built with createElement.
// ---------------------------------------------------------------------------

export const config = { runtime: 'edge' };

const h = React.createElement;

export default function handler(req: Request): Response {
  const { searchParams } = new URL(req.url);
  const home = (searchParams.get('h') || 'TBD').slice(0, 40);
  const away = (searchParams.get('a') || 'TBD').slice(0, 40);
  const meta = (searchParams.get('meta') || '').slice(0, 80);
  const venue = (searchParams.get('venue') || '').slice(0, 60);
  const score = (searchParams.get('score') || '').slice(0, 12); // e.g. "2-1"
  const [sh, sa] = score.split('-');
  const hasScore = score.includes('-') && sh !== '' && sa !== '';

  return new ImageResponse(
    h(
      'div',
      {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0f1f 0%, #11254a 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: '60px',
        },
      },
      h(
        'div',
        {
          style: {
            fontSize: 30,
            letterSpacing: 4,
            color: '#7aa2ff',
            fontWeight: 700,
            marginBottom: 40,
            display: 'flex',
          },
        },
        'FIFA WORLD CUP 2026'
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
            width: '100%',
          },
        },
        h(
          'div',
          { style: { fontSize: 64, fontWeight: 800, flex: 1, textAlign: 'right', display: 'flex', justifyContent: 'flex-end' } },
          home
        ),
        hasScore
          ? h(
              'div',
              { style: { fontSize: 72, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 18 } },
              h('span', { style: { display: 'flex' } }, sh),
              h('span', { style: { color: '#8893a7', fontSize: 48, display: 'flex' } }, '–'),
              h('span', { style: { display: 'flex' } }, sa)
            )
          : h('div', { style: { fontSize: 40, color: '#8893a7', fontWeight: 600, display: 'flex' } }, 'v'),
        h(
          'div',
          { style: { fontSize: 64, fontWeight: 800, flex: 1, textAlign: 'left', display: 'flex' } },
          away
        )
      ),
      meta
        ? h('div', { style: { fontSize: 30, color: '#c9d4e8', marginTop: 44, display: 'flex' } }, meta)
        : null,
      venue
        ? h('div', { style: { fontSize: 24, color: '#7e8aa0', marginTop: 12, display: 'flex' } }, venue)
        : null
    ),
    { width: 1200, height: 630 }
  );
}
