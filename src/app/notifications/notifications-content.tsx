"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Settings,
  Trash2,
  Check,
  Trophy,
  Target,
  ArrowRightLeft,
  Clock,
  Loader2,
} from "lucide-react";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { cn } from "@/lib/utils/cn";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsPageContent() {
  const [activeTab, setActiveTab] = useState<"all" | "settings">("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const clearAll = async () => {
    try {
      await fetch("/api/notifications/clear", {
        method: "POST",
      });
      setNotifications([]);
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "goal":
        return Target;
      case "match_start":
      case "match_end":
        return Clock;
      case "transfer":
        return ArrowRightLeft;
      case "milestone":
        return Trophy;
      default:
        return Bell;
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-neutral-600 mt-1">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {activeTab === "all" && notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="text-sm text-neutral-600 hover:text-red-600 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-neutral-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "all"
                ? "bg-white text-neutral-900 shadow"
                : "text-neutral-600 hover:text-neutral-900"
            )}
          >
            <Bell className="w-4 h-4 inline mr-2" />
            All Notifications
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "settings"
                ? "bg-white text-neutral-900 shadow"
                : "text-neutral-600 hover:text-neutral-900"
            )}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Settings
          </button>
        </div>

        {/* Content */}
        {activeTab === "all" ? (
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-neutral-200">
                <Bell className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  No notifications yet
                </h3>
                <p className="text-neutral-500">
                  Follow players, teams, and competitions to get updates
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
                {notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "flex items-start gap-4 p-4 transition-colors",
                        !notification.isRead && "bg-blue-50/50"
                      )}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          notification.isRead
                            ? "bg-neutral-100"
                            : "bg-blue-100"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-5 h-5",
                            notification.isRead
                              ? "text-neutral-600"
                              : "text-blue-600"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-neutral-900">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-neutral-600 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-xs text-neutral-400 mt-2">
                          {new Date(notification.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <NotificationSettings />
        )}
      </div>
    </div>
  );
}
