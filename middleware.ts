import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    if (pathname.startsWith('/profile%3F') || pathname.startsWith('/profile%3f')) {
        const encodedQuery = pathname.replace(/^\/profile%3[fF]/, '')
        const decodedQuery = decodeURIComponent(encodedQuery)
        const redirectUrl = request.nextUrl.clone()

        redirectUrl.pathname = '/profile'
        redirectUrl.search = decodedQuery ? `?${decodedQuery}` : '?verify=true'

        return NextResponse.redirect(redirectUrl)
    }

    // Actualizar la sesión de Supabase
    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
