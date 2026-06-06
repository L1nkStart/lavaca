'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CampaignReactionsProps {
    campaignId: string
    initialCount?: number
}

export function CampaignReactions({ campaignId, initialCount = 0 }: CampaignReactionsProps) {
    const [count, setCount] = useState(initialCount)
    const [hasReacted, setHasReacted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [user, setUser] = useState<any>(null)

    const supabase = createClient()

    useEffect(() => {
        checkUser()
        loadReactions()
    }, [campaignId])

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
            checkUserReaction(user.id)
        }
    }

    const loadReactions = async () => {
        try {
            const { count: reactionCount } = await supabase
                .from('campaign_reactions')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaignId)

            setCount(reactionCount || 0)
        } catch (err) {
            console.error('Error loading reactions:', err)
        }
    }

    const checkUserReaction = async (userId: string) => {
        try {
            const { data } = await supabase
                .from('campaign_reactions')
                .select('id')
                .eq('campaign_id', campaignId)
                .eq('user_id', userId)
                .single()

            setHasReacted(!!data)
        } catch (err) {
            // No reaction found
            setHasReacted(false)
        }
    }

    const toggleReaction = async () => {
        if (loading) return

        if (!user) {
            // Redirect to login if not authenticated
            window.location.href = '/auth/login?redirectTo=' + window.location.pathname
            return
        }

        setLoading(true)

        try {
            if (hasReacted) {
                // Remove reaction
                const { error } = await supabase
                    .from('campaign_reactions')
                    .delete()
                    .eq('campaign_id', campaignId)
                    .eq('user_id', user.id)

                if (error) throw error

                setHasReacted(false)
                setCount(prev => Math.max(0, prev - 1))
            } else {
                // Add reaction
                const { error } = await supabase
                    .from('campaign_reactions')
                    .insert({
                        campaign_id: campaignId,
                        user_id: user.id
                    })

                if (error) throw error

                setHasReacted(true)
                setCount(prev => prev + 1)
            }
        } catch (err) {
            console.error('Error toggling reaction:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            variant={hasReacted ? "default" : "outline"}
            size="sm"
            onClick={toggleReaction}
            disabled={loading}
            className={cn(
                "gap-2 transition-all",
                hasReacted && "bg-pink-500 hover:bg-pink-600 text-white"
            )}
        >
            <Heart
                className={cn(
                    "h-4 w-4 transition-all",
                    hasReacted && "fill-current"
                )}
            />
            <span>{count}</span>
        </Button>
    )
}
