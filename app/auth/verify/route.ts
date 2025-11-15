import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const token = searchParams.get('token')
    const type = searchParams.get('type')
    const redirectTo = searchParams.get('redirect_to') ?? '/profile'

    if (token && type) {
        const supabase = await createClient()

        const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as any, // 'signup' | 'recovery' | etc.
        })

        if (!error && data.user) {
            // User is now verified, check if profile exists
            const { data: existingProfile } = await supabase
                .from('users')
                .select('id')
                .eq('id', data.user.id)
                .single()

            // Create profile if it doesn't exist (for email verification flow)
            if (!existingProfile) {
                // Use service role or admin privileges to create the profile
                // This bypasses RLS restrictions
                const { error: profileError } = await supabase
                    .from('users')
                    .insert({
                        id: data.user.id,
                        email: data.user.email!,
                        full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'Usuario',
                        avatar_url: data.user.user_metadata?.avatar_url,
                        role: 'donor',
                        kyc_status: 'pending',
                    })

                if (profileError) {
                    console.error('Error creating profile during verification:', profileError)
                    // Continue anyway since the auth verification was successful
                }
            }

            // Successful verification, redirect to intended page
            const forwardedHost = request.headers.get('x-forwarded-host')
            const isLocalEnv = process.env.NODE_ENV === 'development'

            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${redirectTo}?verified=true`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${redirectTo}?verified=true`)
            } else {
                return NextResponse.redirect(`${origin}${redirectTo}?verified=true`)
            }
        }
    }

    // Return the user to login page with error if verification failed
    return NextResponse.redirect(`${origin}/auth/login?error=verification_failed`)
}
