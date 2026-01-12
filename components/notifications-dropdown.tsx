'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

interface Notification {
    id: string
    type: string
    title: string
    message: string
    link: string | null
    read: boolean
    created_at: string
}

export function NotificationsDropdown() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)

    const supabase = createClient()

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
            loadNotifications(user.id)
            subscribeToNotifications(user.id)
        }
    }

    const loadNotifications = async (userId: string) => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10)

            if (error) throw error

            setNotifications(data || [])
            setUnreadCount(data?.filter(n => !n.read).length || 0)
        } catch (err) {
            console.error('Error loading notifications:', err)
        } finally {
            setLoading(false)
        }
    }

    const subscribeToNotifications = (userId: string) => {
        const channel = supabase
            .channel('notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    setNotifications(prev => [payload.new as Notification, ...prev])
                    setUnreadCount(prev => prev + 1)
                }
            )
            .subscribe()

        return () => {
            channel.unsubscribe()
        }
    }

    const markAsRead = async (notificationId: string) => {
        try {
            await supabase
                .from('notifications')
                .update({ read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId)

            setNotifications(prev =>
                prev.map(n =>
                    n.id === notificationId ? { ...n, read: true } : n
                )
            )
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (err) {
            console.error('Error marking notification as read:', err)
        }
    }

    const markAllAsRead = async () => {
        if (!user) return

        try {
            await supabase
                .from('notifications')
                .update({ read: true, read_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('read', false)

            setNotifications(prev =>
                prev.map(n => ({ ...n, read: true }))
            )
            setUnreadCount(0)
        } catch (err) {
            console.error('Error marking all as read:', err)
        }
    }

    if (!user) return null

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notificaciones</span>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={markAllAsRead}
                            className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                        >
                            Marcar todas como leídas
                        </Button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="h-[400px]">
                    {loading ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            Cargando...
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No tienes notificaciones
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <DropdownMenuItem
                                key={notification.id}
                                className="flex flex-col items-start p-3 cursor-pointer"
                                onClick={() => {
                                    console.log('Notification clicked:', notification)
                                    if (!notification.read) {
                                        markAsRead(notification.id)
                                    }
                                    if (notification.link) {
                                        window.location.href = notification.link
                                    }
                                }}
                            >
                                <div className="flex items-start justify-between w-full gap-2">
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">
                                            {notification.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {notification.message}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatDistanceToNow(new Date(notification.created_at), {
                                                addSuffix: true,
                                                locale: es
                                            })}
                                        </p>
                                    </div>
                                    {!notification.read && (
                                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                                    )}
                                </div>
                            </DropdownMenuItem>
                        ))
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
