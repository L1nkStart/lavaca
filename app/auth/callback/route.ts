import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('redirectTo') ?? '/profile'

    if (code) {
        const supabase = await createClient()

        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data.user) {
            // Check if user profile exists
            const { data: existingProfile } = await supabase
                .from('users')
                .select('id')
                .eq('id', data.user.id)
                .single()

            // Create profile if it doesn't exist (OAuth users)
            if (!existingProfile) {
                const { error: profileError } = await supabase
                    .from('users')
                    .insert({
                        id: data.user.id,
                        email: data.user.email!,
                        full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'Usuario',
                        avatar_url: data.user.user_metadata?.avatar_url,
                        role: 'donor', // Default role
                        kyc_status: 'pending',
                    })

                if (profileError) {
                    console.error('Error creating OAuth profile:', profileError)
                }
            }

            // Successful authentication, redirect to intended page
            const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
            const isLocalEnv = process.env.NODE_ENV === 'development'

            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        }
    }

    // Return the user to an error page with instructions if authentication failed
    return NextResponse.redirect(`${origin}/auth/login?error=authentication_failed`)
}
