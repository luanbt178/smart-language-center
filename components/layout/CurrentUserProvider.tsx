"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"

export type CurrentUser = {
  userId: string
  username: string
  fullName: string
  role: string
  roleName: string
  permissions: string[]
}

type CurrentUserState = {
  user: CurrentUser | null
  loading: boolean
}

const CurrentUserContext = createContext<CurrentUserState>({
  user: null,
  loading: true,
})

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CurrentUserState>({
    user: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null
        const data = (await response.json()) as { user?: CurrentUser }
        return data.user ?? null
      })
      .catch(() => null)
      .then((user) => {
        if (!cancelled) setState({ user, loading: false })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <CurrentUserContext.Provider value={state}>
      {children}
    </CurrentUserContext.Provider>
  )
}

export function useCurrentUser(): CurrentUserState {
  return useContext(CurrentUserContext)
}