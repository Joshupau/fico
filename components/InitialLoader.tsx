"use client"

import { useEffect, useState } from 'react'

export default function InitialLoader() {
  const [visible, setVisible] = useState(true)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), 0)
    const removeTimer = setTimeout(() => setVisible(false), 300)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      id="app-loading"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        zIndex: 9999,
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 250ms ease',
      }}
    >
      <svg width="56" height="56" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <circle cx="25" cy="25" r="20" stroke="#e5e7eb" strokeWidth="6" fill="none" />
        <path d="M45 25a20 20 0 0 1-20 20" stroke="#111827" strokeWidth="6" strokeLinecap="round" fill="none">
          <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
        </path>
      </svg>
    </div>
  )
}
