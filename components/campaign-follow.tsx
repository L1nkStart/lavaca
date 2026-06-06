'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Bell, BellOff } from 'lucide-react'

interface CampaignFollowProps {
    campaignId: string
}

export function CampaignFollow({ campaignId }: CampaignFollowProps) {
    const [isFollowing, setIsFollowing] = useState(false)
    const [loading, setLoading] = useState(false)
    const [user, setUser] = useState<any>(null)

    const supabase = createClient()

    useEffect(() => {
        checkUser()
    }, [campaignId])

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
            checkFollowStatus(user.id)
        }
    }

    const checkFollowStatus = async (userId: string) => {
        try {
            const { data } = await supabase
                .from('campaign_followers')
                .select('id')
                .eq('campaign_id', campaignId)
                .eq('user_id', userId)
                .single()

            setIsFollowing(!!data)
        } catch (err) {
            setIsFollowing(false)
        }
    }

    const toggleFollow = async () => {
        if (loading) return

        if (!user) {
            window.location.href = '/auth/login?redirectTo=' + window.location.pathname
            return
        }

        setLoading(true)

        try {
            if (isFollowing) {
                // Unfollow
                const { error } = await supabase
                    .from('campaign_followers')
                    .delete()
                    .eq('campaign_id', campaignId)
                    .eq('user_id', user.id)

                if (error) throw error
                setIsFollowing(false)
            } else {
                // Follow
                const { error } = await supabase
                    .from('campaign_followers')
                    .insert({
                        campaign_id: campaignId,
                        user_id: user.id,
                        notify_updates: true,
                        notify_milestones: true
                    })

                if (error) throw error
                setIsFollowing(true)
            }
        } catch (err) {
            console.error('Error toggling follow:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            variant={isFollowing ? "secondary" : "outline"}
            size="sm"
            onClick={toggleFollow}
            disabled={loading}
            className="gap-2"
        >
            {isFollowing ? (
                <>
                    <BellOff className="h-4 w-4" />
                    <span>Siguiendo</span>
                </>
            ) : (
                <>
                    <Bell className="h-4 w-4" />
                    <span>Seguir</span>
                </>
            )}
        </Button>
    )
}
