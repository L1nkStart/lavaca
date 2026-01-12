'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Comment {
    id: string
    content: string
    is_anonymous: boolean
    donor_name: string | null
    created_at: string
    users: {
        full_name: string
        avatar_url: string | null
    } | null
    user_id: string | null
}

interface CampaignCommentsProps {
    campaignId: string
    campaignSlug: string
}

export function CampaignComments({ campaignId, campaignSlug }: CampaignCommentsProps) {
    const [comments, setComments] = useState<Comment[]>([])
    const [newComment, setNewComment] = useState('')
    const [isAnonymous, setIsAnonymous] = useState(false)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [user, setUser] = useState<any>(null)

    const supabase = createClient()

    // Load comments
    const loadComments = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('campaign_comments')
                .select(`
                    id,
                    content,
                    is_anonymous,
                    donor_name,
                    created_at,
                    user_id,
                    users:user_id (
                        full_name,
                        avatar_url
                    )
                `)
                .eq('campaign_id', campaignId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })

            if (error) throw error
            setComments((data as any) || [])
        } catch (err) {
            console.error('Error loading comments:', err)
        } finally {
            setLoading(false)
        }
    }

    // Check user authentication
    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
    }

    // Load on mount
    useState(() => {
        loadComments()
        checkUser()
    })

    // Submit comment
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim()) return

        setSubmitting(true)
        setError(null)

        try {
            const { error } = await supabase
                .from('campaign_comments')
                .insert({
                    campaign_id: campaignId,
                    user_id: user?.id || null,
                    content: newComment.trim(),
                    is_anonymous: isAnonymous,
                    donor_name: isAnonymous ? 'Anónimo' : null
                })

            if (error) throw error

            setNewComment('')
            setIsAnonymous(false)
            loadComments()
        } catch (err: any) {
            setError(err.message || 'Error al enviar el comentario')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Comentarios ({comments.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Comment Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Textarea
                            placeholder="Escribe un mensaje de apoyo..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            rows={3}
                            disabled={submitting}
                        />
                    </div>

                    {user && (
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="anonymous"
                                checked={isAnonymous}
                                onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
                                disabled={submitting}
                            />
                            <Label
                                htmlFor="anonymous"
                                className="text-sm font-normal cursor-pointer"
                            >
                                Comentar como anónimo
                            </Label>
                        </div>
                    )}

                    <Button type="submit" disabled={!newComment.trim() || submitting}>
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4 mr-2" />
                                Enviar comentario
                            </>
                        )}
                    </Button>
                </form>

                {/* Comments List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No hay comentarios aún</p>
                            <p className="text-sm">Sé el primero en dejar un mensaje de apoyo</p>
                        </div>
                    ) : (
                        comments.map((comment) => (
                            <div key={comment.id} className="flex gap-3 p-4 rounded-lg bg-muted/50">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage
                                        src={comment.is_anonymous ? undefined : comment.users?.avatar_url || ''}
                                        alt={comment.is_anonymous ? 'Anónimo' : comment.users?.full_name || 'Usuario'}
                                    />
                                    <AvatarFallback>
                                        {comment.is_anonymous
                                            ? '?'
                                            : comment.users?.full_name?.charAt(0).toUpperCase() || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold text-sm">
                                            {comment.is_anonymous
                                                ? 'Anónimo'
                                                : comment.users?.full_name || 'Usuario'}
                                        </p>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(comment.created_at), {
                                                addSuffix: true,
                                                locale: es,
                                            })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {comment.content}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
