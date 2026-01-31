import React from 'react'
import { Navigate } from 'react-router-dom'

export default function RoleRoute({ user, allow = [], children }) {
  if (!user) return <Navigate to="/login" replace />
  if (allow.length && !allow.includes(user.role)) return <Navigate to="/events" replace />
  return children
}
