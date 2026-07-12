import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">٤٠٤</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.
        </p>
        <div className="mt-6">
          <Link to="/" className="btn-primary inline-flex">العودة إلى الرئيسية</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">حدث خطأ ما</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          لم نتمكن من تحميل هذه الصفحة. يمكنك المحاولة مجدداً أو العودة للرئيسية.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="btn-primary"
          >
            إعادة المحاولة
          </button>
          <a href="/" className="btn-ghost">الرئيسية</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "الماكينة الانتخابية وسجل العائلات" },
      { name: "description", content: "منصة شاملة لإدارة الاستمارات العائلية والناخبين في لبنان" },
      { property: "og:title", content: "الماكينة الانتخابية وسجل العائلات" },
      { property: "og:description", content: "إدارة الاستمارات العائلية وقاعدة بيانات الناخبين" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@500;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Nav() {
  const links: Array<{ to: string; label: string }> = [
    { to: "/", label: "لوحة التحكم" },
    { to: "/families/new", label: "إضافة استمارة" },
    { to: "/import", label: "استيراد Excel" },
    { to: "/individuals", label: "قائمة الأفراد" },
    { to: "/search", label: "البحث الذكي" },
  ];
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <img
            src="/logo.svg"
            alt="شعار التطبيق"
            className="h-11 w-11 shrink-0 rounded-2xl border border-border bg-card object-cover"
          />
          <div className="min-w-0">
            <div className="font-extrabold text-base sm:text-lg leading-tight truncate">
              الماكينة الانتخابية
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
              سجل العائلات والناخبين
            </div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
              activeProps={{ className: "px-3 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted"
            activeProps={{ className: "shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground" }}
            activeOptions={{ exact: l.to === "/" }}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-center text-xs text-muted-foreground">
        <div>© {new Date().getFullYear()} — الماكينة الانتخابية وسجل العائلات</div>
        <div className="mt-2 font-medium">app dev crafted by said GEDEON</div>
      </footer>
    </QueryClientProvider>
  );
}
