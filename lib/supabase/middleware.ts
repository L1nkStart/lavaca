import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/campaigns',
    '/how-it-works',
    '/about',
    '/faq',
    '/blog',
    '/contact',
    '/privacy',
    '/terms'
  ];

  // Auth routes (should redirect logged users away)
  const authRoutes = ['/auth/login', '/auth/register'];

  // Protected routes that require authentication
  const protectedRoutes = [
    '/creator',
    '/admin',
    '/profile',
    '/dashboard'
  ];

  // Routes that require specific verification
  const verifiedRoutes = [
    '/creator/campaigns',
    '/creator/create'
  ];

  // Admin routes
  const adminRoutes = ['/admin'];

  // If user is logged in and trying to access auth pages, redirect to dashboard
  if (user && authRoutes.some(route => path.startsWith(route))) {
    const url = request.nextUrl.clone();

    // Get user profile to determine redirect
    const { data: profile } = await supabase
      .from('users')
      .select('role, kyc_status')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'admin') {
      url.pathname = '/admin/dashboard';
    } else if (profile?.role === 'creator') {
      url.pathname = '/creator/dashboard';
    } else {
      url.pathname = '/profile';
    }
    return NextResponse.redirect(url);
  }

  // If not logged in and trying to access protected routes, redirect to login
  if (!user && (
    protectedRoutes.some(route => path.startsWith(route)) ||
    verifiedRoutes.some(route => path.startsWith(route)) ||
    adminRoutes.some(route => path.startsWith(route))
  )) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirectTo', path);
    return NextResponse.redirect(url);
  }

  // If logged in, check for specific role/verification requirements
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, kyc_status')
      .eq('id', user.id)
      .single();

    // Admin routes - only for admin users
    if (adminRoutes.some(route => path.startsWith(route)) && profile?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // Verified routes - only for verified creators
    if (verifiedRoutes.some(route => path.startsWith(route))) {
      if (profile?.role !== 'creator' || profile?.kyc_status !== 'verified') {
        const url = request.nextUrl.clone();
        url.pathname = '/profile?verify=true';
        return NextResponse.redirect(url);
      }
    }

    // Creator routes - only for creators
    if (path.startsWith('/creator') && profile?.role !== 'creator' && profile?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/profile?becomeCreator=true';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
