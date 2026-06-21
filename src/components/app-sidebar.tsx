import { Link, useRouterState } from "@tanstack/react-router";
import { Home, FileText, Network, Sparkles, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

const items = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Notes", url: "/notes", icon: FileText },
  { title: "Knowledge graph", url: "/graph", icon: Network },
  { title: "Insights", url: "/insights", icon: Sparkles },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground font-serif text-lg font-medium">
            n
          </div>
          <span className="font-serif text-lg tracking-tight group-data-[collapsible=icon]:hidden">
            noted
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  item.url === "/"
                    ? path === "/"
                    : path === item.url || path.startsWith(`${item.url}/`);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-2 text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}