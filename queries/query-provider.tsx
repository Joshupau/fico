"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useState } from "react"
import { Toaster } from "react-hot-toast"
import { useSupabaseAuthSync } from "@/store/auth-store"

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  useSupabaseAuthSync()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          className: ' bg-red-500',
          success:{
            icon: '✓',
            style: {
              padding: '10px',
              color: 'white',
              backgroundColor: 'black',
              fontSize: '12px',
              borderRadius: '2px',
              border: '1px solid #27272a',
            }
          },
           error:{
            icon: '✕',
            style: {
              padding: '10px',
              color: 'white',
              backgroundColor: 'black',
              fontSize: '12px',
              borderRadius: '2px',
              border: '1px solid #27272a',
            }
          },
          style: {
            padding: '8px',
            color: 'black',
            fontSize: '12px',
          },
        }}
      />
  </QueryClientProvider>
  )
}
