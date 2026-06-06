import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const tokenHash = searchParams.get('token_hash') ?? searchParams.get('token')
    const type = searchParams.get('type')
    const code = searchParams.get('code')
    const redirectTo = searchParams.get('redirect_to') ?? '/'
    const supabase = await createClient()

    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'

    const buildRedirect = (path: string) => {
        if (isLocalEnv) {
            return NextResponse.redirect(`${origin}${path}`)
        }

        if (forwardedHost) {
            return NextResponse.redirect(`https://${forwardedHost}${path}`)
        }

        return NextResponse.redirect(`${origin}${path}`)
    }

    const successPath = `/auth/login?verified=true&redirectTo=${encodeURIComponent(redirectTo)}`

    // Flow 1: PKCE/OAuth-style links that include "code"
    if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data.user) {
            const { data: existingProfile } = await supabase
                .from('users')
                .select('id')
                .eq('id', data.user.id)
                .maybeSingle()

            if (!existingProfile) {
                await supabase
                    .from('users')
                    .upsert({
                        id: data.user.id,
                        email: data.user.email!,
                        full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'Usuario',
                        avatar_url: data.user.user_metadata?.avatar_url,
                        role: 'donor',
                        kyc_status: 'pending',
                    }, { onConflict: 'id' })
            }

            return buildRedirect(successPath)
        }
    }

    // Flow 2: OTP-style links that include token_hash/token + type
    if (tokenHash && type) {

        const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any, // 'signup' | 'recovery' | etc.
        })

        if (!error && data.user) {
            // User is now verified, check if profile exists
            const { data: existingProfile } = await supabase
                .from('users')
                .select('id')
                .eq('id', data.user.id)
                .maybeSingle()

            // Create profile if it doesn't exist (for email verification flow)
            if (!existingProfile) {
                const { error: profileError } = await supabase
                    .from('users')
                    .upsert({
                        id: data.user.id,
                        email: data.user.email!,
                        full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'Usuario',
                        avatar_url: data.user.user_metadata?.avatar_url,
                        role: 'donor',
                        kyc_status: 'pending',
                    }, { onConflict: 'id' })

                if (profileError) {
                    console.error('Error creating profile during verification:', profileError)
                    // Continue anyway since the auth verification was successful
                }
            }

            return buildRedirect(successPath)
        }

        // If token was already used, avoid false negative when user is already verified
        const { data: userData } = await supabase.auth.getUser()
        if (userData.user?.email_confirmed_at) {
            return buildRedirect(successPath)
        }
    }

    // Return the user to login page with error if verification failed
    return buildRedirect('/auth/login?error=verification_failed')
}
