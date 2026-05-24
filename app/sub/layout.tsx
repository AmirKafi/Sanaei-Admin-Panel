import { ThemeProvider } from "@/components/theme-provider"

export default function SubLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="subscription-theme">
      {children}
    </ThemeProvider>
  )
}
