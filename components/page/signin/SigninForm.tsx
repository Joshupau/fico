'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Eye, EyeOff, X } from 'lucide-react'
import { useHistory, Link } from 'react-router-dom'
import { usePassportLogin } from '@/queries/auth/auth'
import toast from 'react-hot-toast'
import { jwtDecode } from 'jwt-decode'
import { AccessToken } from '@/types/auth'
import { useAuthStore } from '@/store/auth-store'
import { useSettingsStore } from '@/store/settings-store'

export function SigninForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [usernameVal, setUsernameVal] = useState('')
  const [passwordVal, setPasswordVal] = useState('')
  const { mutate: loginUser, isPending } = usePassportLogin()
  const { setAuth } = useAuthStore()
  const { onboardingCompleted, defaultLandingPage } = useSettingsStore()
  const history = useHistory()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isPending || !usernameVal || !passwordVal) return

    loginUser({
      username: usernameVal.trim(),
      password: passwordVal.trim(),
    }, {
      onSuccess: (data) => {
        const token = jwtDecode<AccessToken>(data.data?.access)
        localStorage.setItem('auth', data.data?.access)
        setAuth(token)
        toast.success('Logged in successfully!')
        history.push(onboardingCompleted ? defaultLandingPage : '/onboarding')
      },
    })
  }

  const handleGoogleLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
    if (!apiUrl) {
      toast.error('API URL not configured')
      return
    }
    window.location.href = `${apiUrl}/auth/google`
  }

  const inputBase =
    'w-full bg-white dark:bg-zinc-800/70 border border-gray-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all'

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Logo & heading */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-[72px] h-[72px] rounded-[20px] overflow-hidden mb-5 shadow-sm bg-white dark:bg-zinc-800 flex items-center justify-center">
          <Image
            src="/FicoLogoTrans1.png"
            alt="Fico"
            width={60}
            height={60}
            className="w-[60px] h-[60px] object-contain"
          />
        </div>
        <h1 className="text-[28px] font-bold text-gray-900 dark:text-white leading-tight">Log in or sign up</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1.5">Manage your finances with Fico</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Username */}
        <div className="relative">
          <input
            type="text"
            value={usernameVal}
            onChange={e => setUsernameVal(e.target.value)}
            placeholder="Username or email"
            autoComplete="username"
            className={inputBase}
          />
          {usernameVal && (
            <button
              type="button"
              onClick={() => setUsernameVal('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              <div className="w-5 h-5 bg-gray-200 dark:bg-zinc-600 rounded-full flex items-center justify-center">
                <X className="w-3 h-3" />
              </div>
            </button>
          )}
        </div>

        {/* Password */}
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={passwordVal}
            onChange={e => setPasswordVal(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className={`${inputBase} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex justify-end -mt-0.5">
          <Link
            to="#"
            className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Continue button */}
        <button
          type="submit"
          disabled={isPending || !usernameVal || !passwordVal}
          className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl py-3.5 font-semibold text-[15px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {isPending ? 'Signing in…' : 'Continue'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700" />
        <span className="text-xs text-gray-400 dark:text-zinc-500">or</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700" />
      </div>

      {/* Google OAuth */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full bg-white dark:bg-zinc-800/70 border border-gray-200 dark:border-zinc-700 rounded-2xl py-3.5 font-semibold text-[14px] text-gray-800 dark:text-white flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {/* Sign up link */}
      <p className="text-center text-[13px] text-gray-500 dark:text-zinc-400 mt-6">
        New to Fico?{' '}
        <Link
          to="/signup"
          className="text-gray-900 dark:text-white font-semibold hover:underline"
        >
          Create an account
        </Link>
      </p>

      {/* Terms */}
      <p className="text-center text-[11px] text-gray-400 dark:text-zinc-600 mt-3 leading-relaxed">
        By continuing, you agree to our{' '}
        <Link to="#" className="underline hover:text-gray-600 dark:hover:text-zinc-400">Terms</Link>
        {' '}and{' '}
        <Link to="#" className="underline hover:text-gray-600 dark:hover:text-zinc-400">Privacy Policy</Link>
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 12.01 17.64 10.79 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}
