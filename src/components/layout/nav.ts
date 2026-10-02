import { Bot, Camera, ClipboardList, LayoutDashboard, MessageCircle, MessagesSquare, Package, Send, Settings, Users, Workflow, Image as ImageIcon, ClipboardCheck, CircleDot, Radio, FileText, type LucideIcon } from "lucide-react";

export interface NavItem { label: string; href: string; icon: LucideIcon }
export interface NavGroup { title?: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Instagram",
    items: [
      { label: "Overview", href: "/instagram", icon: Camera },
      { label: "Ready to Post", href: "/instagram/ready", icon: ClipboardCheck },
      { label: "Posts", href: "/instagram/posts", icon: ImageIcon },
      { label: "Stories", href: "/instagram/stories", icon: CircleDot },
      { label: "Comments", href: "/instagram/comments", icon: MessageCircle },
      { label: "Direct Messages", href: "/instagram/messages", icon: MessagesSquare },
    ],
  },
  {
    title: "Telegram",
    items: [
      { label: "Overview", href: "/telegram", icon: Send },
      { label: "Channel", href: "/telegram/channel", icon: Radio },
      { label: "Posts", href: "/telegram/posts", icon: FileText },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "AI Assistant", href: "/ai", icon: Bot },
      { label: "Automations", href: "/automations", icon: Workflow },
      { label: "Products", href: "/products", icon: Package },
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Activity Logs", href: "/logs", icon: ClipboardList },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];
