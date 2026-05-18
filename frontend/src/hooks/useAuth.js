'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { login as apiLogin, register as apiRegister, getMe } from '../api/auth';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('wuag_token');
    if (token) {
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('wuag_token');
          localStorage.removeItem('wuag_user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await apiLogin({ email, password });
    const { token, userId, isAdmin, profileComplete } = res.data;
    localStorage.setItem('wuag_token', token);
    const me = await getMe();
    setUser(me.data);
    if (!profileComplete) {
      router.push('/profile/setup');
    } else {
      router.push('/swipe');
    }
    return res.data;
  }, [router]);

  const register = useCallback(async (email, password, phone) => {
    const res = await apiRegister({ email, password, phone });
    const { token } = res.data;
    localStorage.setItem('wuag_token', token);
    router.push('/profile/setup');
    return res.data;
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('wuag_token');
    localStorage.removeItem('wuag_user');
    setUser(null);
    router.push('/login');
  }, [router]);

  return { user, loading, login, register, logout };
}
