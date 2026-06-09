import { NextResponse } from 'next/server'

const PUBLIC_FILE = /\.(.*)$/

export function middleware(request) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/media') ||
    pathname === '/favicon.ico' ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = '/index.html'
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: '/:path*',
}